import { MAX_CHANNEL_MESSAGE_BYTES, parseChannelMessage, parseSignalEnvelope, type ChannelMessage, type IceConfig, type Participant, type PeerSignal, type RoomSummary } from "@open-jigsaw-puzzle/shared/protocol";
import { apiClient, apiErrorMessage } from "./api/client";

type SignalingHandlers = {
  onHello: (participantId: string, participants: Participant[], room: RoomSummary) => void;
  onPeerJoined: (participant: Participant, participants: Participant[]) => void;
  onPeerLeft: (participantId: string, participants: Participant[]) => void;
  onParticipantUpdated: (participant: Participant, participants: Participant[]) => void;
  onSignal: (from: string, payload: PeerSignal) => void;
  onError: (message: string) => void;
  onClose: (message: string) => void;
};

type MeshHandlers = {
  onMessage: (from: string, message: ChannelMessage) => void;
  onConnectionChange: (connected: number) => void;
};

const MAX_PENDING_MESSAGES_PER_PEER = 512;
const MAX_PENDING_ICE_CANDIDATES_PER_PEER = 128;
const MAX_CHANNEL_BUFFERED_AMOUNT = 1_000_000;
const CHANNEL_BUFFERED_AMOUNT_LOW_THRESHOLD = 256_000;
const RECONNECT_DELAY_MS = 750;

export async function fetchIceConfig(): Promise<IceConfig> {
  const { data, error } = await apiClient.GET("/api/ice");
  if (!data) throw new Error(apiErrorMessage(error, "ICE configuration could not be loaded."));
  return data;
}

export function openSignaling(roomId: string, name: string, handlers: SignalingHandlers): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/api/rooms/${encodeURIComponent(roomId)}/socket?name=${encodeURIComponent(name)}`);

  socket.addEventListener("message", (event) => {
    try {
      const message = parseSignalEnvelope(JSON.parse(event.data as string));
      if (!message) throw new Error("Invalid signaling message.");
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
        case "participant-updated":
          handlers.onParticipantUpdated(message.participant, message.participants);
          break;
        case "signal":
          handlers.onSignal(message.from, message.payload);
          break;
        case "error":
          handlers.onError(message.message);
          break;
      }
    } catch {
      handlers.onError("Signaling server sent an invalid message.");
    }
  });

  socket.addEventListener("error", () => handlers.onError("Signaling connection failed."));
  socket.addEventListener("close", (event) => {
    if (event.wasClean) return;
    handlers.onClose(event.reason || "Signaling connection closed unexpectedly.");
  });
  return socket;
}

export class PeerMesh {
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly pendingMessages = new Map<string, string[]>();
  private readonly pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
  private readonly participantIds = new Set<string>();
  private readonly reconnectTimers = new Map<string, number>();
  private closed = false;

  constructor(
    private readonly myId: string,
    private readonly iceConfig: IceConfig,
    private readonly sendSignal: (to: string, payload: PeerSignal) => void,
    private readonly handlers: MeshHandlers,
  ) {}

  connectToParticipants(participants: Participant[]): void {
    for (const participant of participants) {
      if (participant.id === this.myId) continue;
      this.participantIds.add(participant.id);
      if (!this.peers.has(participant.id)) this.startConnection(participant.id);
    }
  }

  async acceptSignal(from: string, signal: PeerSignal): Promise<void> {
    if (this.closed || !this.participantIds.has(from)) return;
    const peer = this.ensurePeer(from);

    try {
      if (signal.type === "offer") {
        await peer.setRemoteDescription(signal.description);
        await this.flushPendingIce(from, peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (peer.localDescription) {
          this.sendSignal(from, {
            type: "answer",
            description: { type: "answer", sdp: peer.localDescription.sdp },
          });
        }
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
    } catch (error) {
      this.resetPeer(from, peer);
      throw error;
    }
  }

  broadcast(message: ChannelMessage): void {
    for (const participantId of this.peers.keys()) this.send(participantId, message);
  }

  send(to: string, message: ChannelMessage): void {
    const channel = this.channels.get(to);
    const payload = JSON.stringify(message);
    if (channel?.readyState === "open" && !this.pendingMessages.has(to) && getBufferedAmount(channel) <= MAX_CHANNEL_BUFFERED_AMOUNT) {
      channel.send(payload);
      return;
    }
    this.queueMessage(to, payload);
    if (channel?.readyState === "open") this.drainPending(to, channel);
  }

  disconnect(participantId: string): void {
    this.participantIds.delete(participantId);
    this.clearReconnect(participantId);
    this.cleanupPeer(participantId);
    this.pendingMessages.delete(participantId);
    this.pendingIceCandidates.delete(participantId);
    this.emitConnectionChange();
  }

  close(): void {
    this.closed = true;
    for (const peerId of this.peers.keys()) this.disconnect(peerId);
    for (const timer of this.reconnectTimers.values()) window.clearTimeout(timer);
    this.reconnectTimers.clear();
  }

  private startConnection(participantId: string): void {
    if (this.closed || !this.participantIds.has(participantId)) return;
    const peer = this.ensurePeer(participantId);
    if (this.myId >= participantId) return;

    const channel = peer.createDataChannel("puzzle", { ordered: true });
    this.attachChannel(participantId, channel);
    void peer
      .createOffer()
      .then((offer) => peer.setLocalDescription(offer))
      .then(() => {
        if (peer.localDescription && this.peers.get(participantId) === peer) {
          this.sendSignal(participantId, {
            type: "offer",
            description: { type: "offer", sdp: peer.localDescription.sdp },
          });
        }
      })
      .catch(() => {
        this.resetPeer(participantId, peer);
        this.scheduleReconnect(participantId);
      });
  }

  private ensurePeer(participantId: string): RTCPeerConnection {
    const existing = this.peers.get(participantId);
    if (existing && existing.connectionState !== "closed" && existing.connectionState !== "failed") return existing;
    if (existing) this.resetPeer(participantId, existing);

    const peer = new RTCPeerConnection(this.iceConfig);
    peer.addEventListener("icecandidate", (event) => {
      if (event.candidate) this.sendSignal(participantId, { type: "ice", candidate: event.candidate.toJSON() });
    });
    peer.addEventListener("datachannel", (event) => this.attachChannel(participantId, event.channel));
    peer.addEventListener("connectionstatechange", () => {
      this.emitConnectionChange();
      if (peer.connectionState !== "failed" && peer.connectionState !== "closed") return;
      this.resetPeer(participantId, peer);
      this.scheduleReconnect(participantId);
    });
    this.peers.set(participantId, peer);
    return peer;
  }

  private attachChannel(participantId: string, channel: RTCDataChannel): void {
    const previous = this.channels.get(participantId);
    if (previous && previous !== channel) previous.close();
    this.channels.set(participantId, channel);
    channel.bufferedAmountLowThreshold = CHANNEL_BUFFERED_AMOUNT_LOW_THRESHOLD;
    channel.addEventListener("open", () => {
      this.drainPending(participantId, channel);
      this.emitConnectionChange();
    });
    channel.addEventListener("bufferedamountlow", () => this.drainPending(participantId, channel));
    channel.addEventListener("close", () => {
      if (this.channels.get(participantId) === channel) this.channels.delete(participantId);
      this.emitConnectionChange();
    });
    channel.addEventListener("message", (event) => {
      try {
        if (typeof event.data !== "string" || event.data.length > MAX_CHANNEL_MESSAGE_BYTES) return;
        const message = parseChannelMessage(JSON.parse(event.data) as unknown);
        if (!message) return;
        this.handlers.onMessage(participantId, message);
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

  private drainPending(participantId: string, channel: RTCDataChannel): void {
    const queue = this.pendingMessages.get(participantId);
    if (!queue?.length) return;
    while (queue.length > 0 && channel.readyState === "open" && getBufferedAmount(channel) <= MAX_CHANNEL_BUFFERED_AMOUNT) {
      const payload = queue.shift();
      if (payload) channel.send(payload);
    }
    if (queue.length === 0) this.pendingMessages.delete(participantId);
  }

  private queueIce(participantId: string, candidate: RTCIceCandidateInit): void {
    const queue = this.pendingIceCandidates.get(participantId) ?? [];
    queue.push(candidate);
    if (queue.length > MAX_PENDING_ICE_CANDIDATES_PER_PEER) queue.splice(0, queue.length - MAX_PENDING_ICE_CANDIDATES_PER_PEER);
    this.pendingIceCandidates.set(participantId, queue);
  }

  private async flushPendingIce(participantId: string, peer: RTCPeerConnection): Promise<void> {
    const queue = this.pendingIceCandidates.get(participantId);
    if (!queue?.length) return;
    this.pendingIceCandidates.delete(participantId);
    for (const candidate of queue) {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Stale ICE candidates can arrive around renegotiation; later candidates may still work.
      }
    }
  }

  private scheduleReconnect(participantId: string): void {
    if (this.closed || !this.participantIds.has(participantId) || this.reconnectTimers.has(participantId)) return;
    const timer = window.setTimeout(() => {
      this.reconnectTimers.delete(participantId);
      if (!this.peers.has(participantId)) this.startConnection(participantId);
    }, RECONNECT_DELAY_MS);
    this.reconnectTimers.set(participantId, timer);
  }

  private clearReconnect(participantId: string): void {
    const timer = this.reconnectTimers.get(participantId);
    if (timer !== undefined) window.clearTimeout(timer);
    this.reconnectTimers.delete(participantId);
  }

  private resetPeer(participantId: string, expectedPeer: RTCPeerConnection): void {
    if (this.peers.get(participantId) !== expectedPeer) return;
    this.cleanupPeer(participantId);
    this.pendingIceCandidates.delete(participantId);
    this.emitConnectionChange();
  }

  private cleanupPeer(participantId: string): void {
    const channel = this.channels.get(participantId);
    this.channels.delete(participantId);
    channel?.close();

    const peer = this.peers.get(participantId);
    this.peers.delete(participantId);
    peer?.close();
  }

  private emitConnectionChange(): void {
    const connected = [...this.channels.values()].filter((channel) => channel.readyState === "open").length;
    this.handlers.onConnectionChange(connected);
  }
}

function getBufferedAmount(channel: RTCDataChannel): number {
  return typeof channel.bufferedAmount === "number" ? channel.bufferedAmount : 0;
}
