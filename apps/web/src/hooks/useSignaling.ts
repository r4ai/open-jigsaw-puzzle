import { useEffect, useRef, useState } from "react";
import type { ChannelMessage, IceConfig, Participant, RoomSummary } from "@open-puzzle/shared/protocol";
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

export function useSignaling(name: string, events: Events) {
  const [myId, setMyId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const meshRef = useRef<PeerMesh | null>(null);
  const connectionAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const nameRef = useRef(name);
  nameRef.current = name;
  // Always call the latest event handlers even when callbacks are recreated
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    return () => {
      connectionAttemptRef.current += 1;
      clearReconnect();
      socketRef.current?.close();
      meshRef.current?.close();
    };
  }, []);

  function clearReconnect() {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  function closeConnection() {
    socketRef.current?.close();
    socketRef.current = null;
    meshRef.current?.close();
    meshRef.current = null;
  }

  function isCurrentAttempt(attempt: number, socket: WebSocket): boolean {
    return connectionAttemptRef.current === attempt && socketRef.current === socket;
  }

  function sendSignal(socket: WebSocket, to: string, payload: unknown) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "signal", to, payload }));
  }

  async function enterRoom(roomId: string, options: { preserveState?: boolean } = {}) {
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    clearReconnect();
    closeConnection();

    if (options.preserveState) {
      setParticipants([]);
      setMyId(null);
      setConnectedPeers(0);
    } else {
      reconnectAttemptsRef.current = 0;
      setRoom(null);
      setParticipants([]);
      setMyId(null);
      setConnectedPeers(0);
    }

    let iceConfig: IceConfig;
    try {
      iceConfig = await fetchIceConfig();
    } catch (err) {
      if (connectionAttemptRef.current !== attempt) return;
      eventsRef.current.onError(err instanceof Error ? err.message : "ICE config load failed.");
      return;
    }
    if (connectionAttemptRef.current !== attempt) return;

    const socket = openSignaling(roomId, nameRef.current, {
      onHello: (participantId, nextParticipants, nextRoom) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        reconnectAttemptsRef.current = 0;
        const mesh = new PeerMesh(
          participantId,
          iceConfig,
          (to, payload) => sendSignal(socket, to, payload),
          {
            onMessage: (from, msg) => eventsRef.current.onMessage(from, msg),
            onConnectionChange: (connected) => {
              if (!isCurrentAttempt(attempt, socket)) return;
              setConnectedPeers(connected);
              eventsRef.current.onConnectionChange(connected);
            },
          },
        );
        meshRef.current = mesh;
        setMyId(participantId);
        setRoom(nextRoom);
        setParticipants(nextParticipants);
        eventsRef.current.onHello(participantId, nextParticipants, nextRoom);
        mesh.connectToParticipants(nextParticipants);
      },
      onPeerJoined: (participant, nextParticipants) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        setParticipants(nextParticipants);
        meshRef.current?.connectToParticipants(nextParticipants);
        eventsRef.current.onPeerJoined(participant, nextParticipants);
      },
      onPeerLeft: (participantId, nextParticipants) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        setParticipants(nextParticipants);
        eventsRef.current.onPeerLeft(participantId, nextParticipants);
        meshRef.current?.disconnect(participantId);
      },
      onParticipantUpdated: (participant, nextParticipants) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        setParticipants(nextParticipants);
        eventsRef.current.onParticipantUpdated(participant, nextParticipants);
      },
      onSignal: (from, payload) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        void meshRef.current?.acceptSignal(from, payload).catch((err) => {
          if (isCurrentAttempt(attempt, socket))
            eventsRef.current.onError(err instanceof Error ? err.message : "Signal error.");
        });
      },
      onError: (message) => {
        if (isCurrentAttempt(attempt, socket)) eventsRef.current.onError(message);
      },
      onClose: (message) => {
        if (!isCurrentAttempt(attempt, socket)) return;
        meshRef.current?.close();
        meshRef.current = null;
        setConnectedPeers(0);
        eventsRef.current.onClose(message);
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          if (connectionAttemptRef.current === attempt) void enterRoom(roomId, { preserveState: true });
        }, RECONNECT_DELAY_MS);
      },
    });

    socketRef.current = socket;
  }

  function broadcast(msg: ChannelMessage) {
    meshRef.current?.broadcast(msg);
  }

  function send(to: string, msg: ChannelMessage) {
    meshRef.current?.send(to, msg);
  }

  function updateName(nextName: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "update-name", name: nextName }));
  }

  return { myId, room, participants, connectedPeers, enterRoom, broadcast, send, updateName };
}
