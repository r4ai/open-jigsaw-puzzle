import { createSignal, onCleanup } from "solid-js";
import type {
  ChannelMessage,
  IceConfig,
  Participant,
  RoomSummary,
} from "@open-jigsaw-puzzle/shared/protocol";
import { fetchIceConfig, openSignaling, PeerMesh } from "../realtime";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1_500;

type Events = {
  onMessage: (from: string, msg: ChannelMessage) => void;
  onHello: (myId: string, participants: Participant[], room: RoomSummary) => void;
  onPeerJoined: (participant: Participant, participants: Participant[]) => void;
  onPeerLeft: (participantId: string, participants: Participant[]) => void;
  onParticipantUpdated: (participant: Participant, participants: Participant[]) => void;
  onConnectionChange: (connected: number) => void;
  onError: (msg: string) => void;
  onClose: (msg: string) => void;
};

/**
 * Owns the WebSocket signaling connection and the WebRTC peer mesh for a room.
 * Re-establishes the connection with bounded retries when the socket closes.
 */
export function useSignaling(getName: () => string, events: Events) {
  const [myId, setMyId] = createSignal<string | null>(null);
  const [room, setRoom] = createSignal<RoomSummary | null>(null);
  const [participants, setParticipants] = createSignal<Participant[]>([]);
  const [connectedPeers, setConnectedPeers] = createSignal(0);

  let socket: WebSocket | null = null;
  let mesh: PeerMesh | null = null;
  let connectionAttempt = 0;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;

  onCleanup(() => {
    connectionAttempt += 1;
    clearReconnect();
    socket?.close();
    mesh?.close();
  });

  function clearReconnect() {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function closeConnection() {
    socket?.close();
    socket = null;
    mesh?.close();
    mesh = null;
  }

  function isCurrentAttempt(attempt: number, s: WebSocket): boolean {
    return connectionAttempt === attempt && socket === s;
  }

  function sendSignal(s: WebSocket, to: string, payload: unknown) {
    if (s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify({ type: "signal", to, payload }));
  }

  async function enterRoom(roomId: string, options: { preserveState?: boolean } = {}) {
    const attempt = connectionAttempt + 1;
    connectionAttempt = attempt;
    clearReconnect();
    closeConnection();

    if (options.preserveState) {
      setParticipants([]);
      setMyId(null);
      setConnectedPeers(0);
    } else {
      reconnectAttempts = 0;
      setRoom(null);
      setParticipants([]);
      setMyId(null);
      setConnectedPeers(0);
    }

    let iceConfig: IceConfig;
    try {
      iceConfig = await fetchIceConfig();
    } catch (err) {
      if (connectionAttempt !== attempt) return;
      events.onError(err instanceof Error ? err.message : "ICE config load failed.");
      return;
    }
    if (connectionAttempt !== attempt) return;

    const ws = openSignaling(roomId, getName(), {
      onHello: (participantId, nextParticipants, nextRoom) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        reconnectAttempts = 0;
        const peerMesh = new PeerMesh(
          participantId,
          iceConfig,
          (to, payload) => sendSignal(ws, to, payload),
          {
            onMessage: (from, msg) => events.onMessage(from, msg),
            onConnectionChange: (connected) => {
              if (!isCurrentAttempt(attempt, ws)) return;
              setConnectedPeers(connected);
              events.onConnectionChange(connected);
            },
          },
        );
        mesh = peerMesh;
        setMyId(participantId);
        setRoom(nextRoom);
        setParticipants(nextParticipants);
        events.onHello(participantId, nextParticipants, nextRoom);
        peerMesh.connectToParticipants(nextParticipants);
      },
      onPeerJoined: (participant, nextParticipants) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        setParticipants(nextParticipants);
        mesh?.connectToParticipants(nextParticipants);
        events.onPeerJoined(participant, nextParticipants);
      },
      onPeerLeft: (participantId, nextParticipants) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        setParticipants(nextParticipants);
        events.onPeerLeft(participantId, nextParticipants);
        mesh?.disconnect(participantId);
      },
      onParticipantUpdated: (participant, nextParticipants) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        setParticipants(nextParticipants);
        events.onParticipantUpdated(participant, nextParticipants);
      },
      onSignal: (from, payload) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        void mesh?.acceptSignal(from, payload).catch((err) => {
          if (isCurrentAttempt(attempt, ws))
            events.onError(err instanceof Error ? err.message : "Signal error.");
        });
      },
      onError: (message) => {
        if (isCurrentAttempt(attempt, ws)) events.onError(message);
      },
      onClose: (message) => {
        if (!isCurrentAttempt(attempt, ws)) return;
        mesh?.close();
        mesh = null;
        setConnectedPeers(0);
        events.onClose(message);
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        reconnectAttempts += 1;
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          if (connectionAttempt === attempt) void enterRoom(roomId, { preserveState: true });
        }, RECONNECT_DELAY_MS);
      },
    });

    socket = ws;
  }

  function broadcast(msg: ChannelMessage) {
    mesh?.broadcast(msg);
  }

  function send(to: string, msg: ChannelMessage) {
    mesh?.send(to, msg);
  }

  function updateName(nextName: string) {
    const s = socket;
    if (!s || s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify({ type: "update-name", name: nextName }));
  }

  return { myId, room, participants, connectedPeers, enterRoom, broadcast, send, updateName };
}
