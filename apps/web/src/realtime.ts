import type { ChannelMessage, IceConfig, Participant, PeerSignal, RoomSummary, SignalEnvelope } from "@open-puzzle/shared/protocol";

type SignalingHandlers = {
  onHello: (participantId: string, participants: Participant[], room: RoomSummary) => void;
  onPeerJoined: (participant: Participant, participants: Participant[]) => void;
  onPeerLeft: (participantId: string, participants: Participant[]) => void;
  onSignal: (from: string, payload: PeerSignal) => void;
  onError: (message: string) => void;
};

type MeshHandlers = {
  onMessage: (from: string, message: ChannelMessage) => void;
  onConnectionChange: (connected: number) => void;
};

const MAX_PENDING_MESSAGES_PER_PEER = 512;

export async function fetchIceConfig(): Promise<IceConfig> {
  const response = await fetch("/api/ice");
  if (!response.ok) throw new Error("ICE configuration could not be loaded.");
  return response.json() as Promise<IceConfig>;
}

export function openSignaling(roomId: string, name: string, handlers: SignalingHandlers): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/api/rooms/${roomId}/socket?name=${encodeURIComponent(name)}`);

  socket.addEventListener("message", (event) => {
    let message: SignalEnvelope;
    try {
      message = JSON.parse(event.data as string) as SignalEnvelope;
    } catch {
      handlers.onError("Signaling server sent an invalid message.");
      return;
    }
    switch (message.type) {
      case "hello":
        handlers.onHello(message.participantId, message.participants, message.room);
        break;
      case "peer-joined":
        handlers.onPeerJoined(message.participant, message.participants);
        break;
      case "peer-left":
        handlers.onPeerLeft(message.participantId, message.participants);
        break;
      case "signal":
        handlers.onSignal(message.from, message.payload);
        break;
      case "error":
        handlers.onError(message.message);
        break;
    }
  });

  socket.addEventListener("error", () => handlers.onError("Signaling connection failed."));
  return socket;
}

export class PeerMesh {
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly pendingMessages = new Map<string, string[]>();
  private readonly pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();

  constructor(
    private readonly myId: string,
    private readonly iceConfig: IceConfig,
    private readonly sendSignal: (to: string, payload: PeerSignal) => void,
    private readonly handlers: MeshHandlers,
  ) {}

  connectToParticipants(participants: Participant[]): void {
    for (const participant of participants) {
      if (participant.id === this.myId || this.peers.has(participant.id)) continue;
      const initiator = this.myId < participant.id;
      const peer = this.ensurePeer(participant.id);
      if (initiator) {
        const channel = peer.createDataChannel("puzzle", { ordered: true });
        this.attachChannel(participant.id, channel);
        void peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            if (peer.localDescription) this.sendSignal(participant.id, { type: "offer", description: peer.localDescription });
          })
          .catch(() => {
            this.disconnect(participant.id);
          });
      }
    }
  }

  async acceptSignal(from: string, signal: PeerSignal): Promise<void> {
    const peer = this.ensurePeer(from);

    if (signal.type === "offer") {
      await peer.setRemoteDescription(signal.description);
      await this.flushPendingIce(from, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (peer.localDescription) this.sendSignal(from, { type: "answer", description: peer.localDescription });
      return;
    }

    if (signal.type === "answer") {
      await peer.setRemoteDescription(signal.description);
      await this.flushPendingIce(from, peer);
      return;
    }

    if (signal.type === "ice" && signal.candidate) {
      if (!peer.remoteDescription) {
        this.queueIce(from, signal.candidate);
        return;
      }
      await peer.addIceCandidate(signal.candidate);
    }
  }

  broadcast(message: ChannelMessage): void {
    for (const participantId of this.peers.keys()) this.send(participantId, message);
  }

  send(to: string, message: ChannelMessage): void {
    const channel = this.channels.get(to);
    const payload = JSON.stringify(message);
    if (channel?.readyState === "open") {
      channel.send(payload);
      return;
    }
    this.queueMessage(to, payload);
  }

  disconnect(participantId: string): void {
    this.channels.get(participantId)?.close();
    this.channels.delete(participantId);
    this.peers.get(participantId)?.close();
    this.peers.delete(participantId);
    this.pendingMessages.delete(participantId);
    this.pendingIceCandidates.delete(participantId);
    this.emitConnectionChange();
  }

  close(): void {
    for (const peerId of this.peers.keys()) this.disconnect(peerId);
  }

  private ensurePeer(participantId: string): RTCPeerConnection {
    const existing = this.peers.get(participantId);
    if (existing) return existing;

    const peer = new RTCPeerConnection(this.iceConfig);
    peer.addEventListener("icecandidate", (event) => {
      if (event.candidate) this.sendSignal(participantId, { type: "ice", candidate: event.candidate.toJSON() });
    });
    peer.addEventListener("datachannel", (event) => this.attachChannel(participantId, event.channel));
    peer.addEventListener("connectionstatechange", () => this.emitConnectionChange());
    this.peers.set(participantId, peer);
    return peer;
  }

  private attachChannel(participantId: string, channel: RTCDataChannel): void {
    this.channels.set(participantId, channel);
    channel.addEventListener("open", () => {
      this.flushPending(participantId, channel);
      this.emitConnectionChange();
    });
    channel.addEventListener("close", () => {
      this.channels.delete(participantId);
      this.emitConnectionChange();
    });
    channel.addEventListener("message", (event) => {
      try {
        this.handlers.onMessage(participantId, JSON.parse(event.data as string) as ChannelMessage);
      } catch {
        // Ignore malformed peer messages. A single bad payload should not break the room.
      }
    });
  }

  private queueMessage(participantId: string, payload: string): void {
    const queue = this.pendingMessages.get(participantId) ?? [];
    queue.push(payload);
    if (queue.length > MAX_PENDING_MESSAGES_PER_PEER) queue.splice(0, queue.length - MAX_PENDING_MESSAGES_PER_PEER);
    this.pendingMessages.set(participantId, queue);
  }

  private flushPending(participantId: string, channel: RTCDataChannel): void {
    const queue = this.pendingMessages.get(participantId);
    if (!queue?.length) return;
    while (queue.length > 0 && channel.readyState === "open") {
      const payload = queue.shift();
      if (payload) channel.send(payload);
    }
    if (queue.length === 0) this.pendingMessages.delete(participantId);
  }

  private queueIce(participantId: string, candidate: RTCIceCandidateInit): void {
    const queue = this.pendingIceCandidates.get(participantId) ?? [];
    queue.push(candidate);
    this.pendingIceCandidates.set(participantId, queue);
  }

  private async flushPendingIce(participantId: string, peer: RTCPeerConnection): Promise<void> {
    const queue = this.pendingIceCandidates.get(participantId);
    if (!queue?.length) return;
    this.pendingIceCandidates.delete(participantId);
    await Promise.all(queue.map((candidate) => peer.addIceCandidate(candidate)));
  }

  private emitConnectionChange(): void {
    const connected = [...this.channels.values()].filter((channel) => channel.readyState === "open").length;
    this.handlers.onConnectionChange(connected);
  }
}
