import { Check, Copy, ImagePlus, Link, Loader2, Maximize2, Minus, Moon, MousePointer2, Play, Plus, Rows3, Sun, Users } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTIES, MAX_PARTICIPANTS, type ChannelMessage, type Difficulty, type Participant, type RoomSummary, type SyncedPiece } from "@open-puzzle/shared/protocol";
import { createInitialPieces, createPuzzleLayout, getWorkspaceMargin, isComplete, snapPiece, type BoardPiece, type PieceEdge, type PieceGeometry, type PuzzleLayout } from "@open-puzzle/shared/puzzle";
import { chunkString, resizeImage } from "./image";
import { fetchIceConfig, openSignaling, PeerMesh } from "./realtime";

type IncomingImage = {
  imageId: string;
  chunks: string[];
  expected: number;
  byteLength: number;
  width: number;
  height: number;
};
type DragState = { id: number; dx: number; dy: number };
type PanState = { pointerId: number; startX: number; startY: number; panX: number; panY: number };
type PanOffset = { x: number; y: number };
type RemoteCursor = { participantId: string; name: string; x: number; y: number; seenAt: number };
type WorkspaceMetrics = {
  margin: number;
};
type LoadingProgress =
  | { phase: "idle" }
  | { phase: "connecting"; startedAt: number }
  | { phase: "resizing"; fileName: string; sourceBytes: number; startedAt: number }
  | { phase: "sending"; chunksSent: number; totalChunks: number; byteLength: number; target: "all" | "peer"; startedAt: number }
  | { phase: "receiving"; imageId: string; chunksReceived: number; totalChunks: number; byteLength: number; startedAt: number }
  | { phase: "complete"; detail: string };

const DEFAULT_NAME = `Player ${Math.floor(Math.random() * 900 + 100)}`;
const MAX_SIGNALING_RECONNECT_ATTEMPTS = 3;

function getInitialTheme(): "light" | "dark" {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
const SIGNALING_RECONNECT_DELAY_MS = 1_500;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_FACTOR = 1.12;

export default function App() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [name, setName] = useState(DEFAULT_NAME);
  const [joinId, setJoinId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(96);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [status, setStatus] = useState("画像を選ぶとパズルを開始できます");
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const [copied, setCopied] = useState(false);
  const meshRef = useRef<PeerMesh | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const incomingRef = useRef<Map<string, IncomingImage>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const imageDataRef = useRef<string | null>(null);
  const imageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const roomRef = useRef<RoomSummary | null>(null);
  const layoutRef = useRef<PuzzleLayout | null>(null);
  const myIdRef = useRef<string | null>(null);
  const piecesRef = useRef<BoardPiece[]>([]);
  const draggingRef = useRef<DragState | null>(null);
  const pendingSyncRef = useRef<SyncedPiece[] | null>(null);
  const enteredRoomRef = useRef<string | null>(null);
  const connectionAttemptRef = useRef(0);
  const signalingReconnectTimerRef = useRef<number | null>(null);
  const signalingReconnectAttemptsRef = useRef(0);
  const lastCursorSentAtRef = useRef(0);

  const layout = useMemo<PuzzleLayout | null>(() => {
    if (!room || !imageSize) return null;
    return createPuzzleLayout(room.difficulty, imageSize.width, imageSize.height);
  }, [imageSize, room]);
  const workspaceMetrics = useMemo<WorkspaceMetrics | null>(() => {
    if (!layout) return null;
    const margin = getWorkspaceMargin(layout);
    return { margin };
  }, [layout]);

  const lockedCount = pieces.filter((piece) => piece.locked).length;
  const complete = isComplete(pieces);
  const isHost = participants.find((participant) => participant.id === myId)?.isHost ?? false;
  const shareUrl = room ? `${window.location.origin}/rooms/${room.id}` : "";
  const loadingSummary = describeLoadingProgress(loadingProgress) ?? status;
  const routeRoomId = getRoomIdFromPath(pathname);
  const viewingRoom = Boolean(routeRoomId);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const roomId = query.get("room");
    if (roomId) {
      const normalizedRoomId = roomId.toUpperCase();
      setJoinId(normalizedRoomId);
      void navigate({ to: "/rooms/$roomId", params: { roomId: normalizedRoomId }, replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!routeRoomId) {
      enteredRoomRef.current = null;
      return;
    }
    const normalizedRoomId = routeRoomId.toUpperCase();
    setJoinId(normalizedRoomId);
    if (enteredRoomRef.current === normalizedRoomId) return;
    enteredRoomRef.current = normalizedRoomId;
    void enterRoom(normalizedRoomId);
  }, [routeRoomId]);

  useEffect(() => {
    return () => {
      connectionAttemptRef.current += 1;
      clearSignalingReconnect();
      socketRef.current?.close();
      meshRef.current?.close();
    };
  }, []);

  useEffect(() => { imageDataRef.current = imageDataUrl; }, [imageDataUrl]);
  useEffect(() => { imageSizeRef.current = imageSize; }, [imageSize]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);

  async function createRoom() {
    setError(null);
    setStatus("部屋を作成しています");
    setLoadingProgress({ phase: "connecting", startedAt: Date.now() });
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      const payload = (await response.json()) as { room?: RoomSummary; error?: string };
      if (!response.ok || !payload.room) {
        setError(payload.error ?? "部屋を作成できませんでした");
        setLoadingProgress({ phase: "idle" });
        return;
      }
      await navigate({ to: "/rooms/$roomId", params: { roomId: payload.room.id } });
    } catch (caught) {
      setError(readError(caught));
      setLoadingProgress({ phase: "idle" });
    }
  }

  function resetRoomState() {
    setRoom(null);
    setParticipants([]);
    setMyId(null);
    setConnectedPeers(0);
    setRemoteCursors([]);
    setImageDataUrl(null);
    setImageSize(null);
    setPieces([]);
    setPan({ x: 0, y: 0 });
    setZoom(0.8);
    incomingRef.current.clear();
    pendingSyncRef.current = null;
    imageDataRef.current = null;
    imageSizeRef.current = null;
    roomRef.current = null;
    layoutRef.current = null;
    myIdRef.current = null;
    piecesRef.current = [];
  }

  function closeCurrentConnection() {
    socketRef.current?.close();
    socketRef.current = null;
    meshRef.current?.close();
    meshRef.current = null;
  }

  function clearSignalingReconnect() {
    if (signalingReconnectTimerRef.current !== null) window.clearTimeout(signalingReconnectTimerRef.current);
    signalingReconnectTimerRef.current = null;
  }

  function isCurrentConnection(attempt: number, socket: WebSocket): boolean {
    return connectionAttemptRef.current === attempt && socketRef.current === socket;
  }

  function sendSignal(socket: WebSocket, to: string, payload: unknown) {
    if (socket.readyState !== WebSocket.OPEN) {
      setError("Signaling connection is not open.");
      return;
    }
    socket.send(JSON.stringify({ type: "signal", to, payload }));
  }

  async function enterRoom(roomId: string, options: { preserveState?: boolean } = {}) {
    const normalizedRoomId = roomId.trim().toUpperCase();
    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    clearSignalingReconnect();
    closeCurrentConnection();
    if (options.preserveState) {
      setParticipants([]);
      setMyId(null);
      setConnectedPeers(0);
      setRemoteCursors([]);
      incomingRef.current.clear();
      pendingSyncRef.current = null;
      myIdRef.current = null;
    } else {
      signalingReconnectAttemptsRef.current = 0;
      resetRoomState();
    }
    setError(null);
    setStatus("部屋へ接続しています");
    setLoadingProgress({ phase: "connecting", startedAt: Date.now() });
    let iceConfig;
    try {
      iceConfig = await fetchIceConfig();
    } catch (caught) {
      if (connectionAttemptRef.current !== attempt) return;
      setError(readError(caught));
      setStatus("接続に失敗しました");
      setLoadingProgress({ phase: "idle" });
      return;
    }

    if (connectionAttemptRef.current !== attempt) return;

    const socket = openSignaling(normalizedRoomId, name, {
      onHello: (participantId, nextParticipants, nextRoom) => {
        if (!isCurrentConnection(attempt, socket)) return;
        signalingReconnectAttemptsRef.current = 0;
        const mesh = new PeerMesh(
          participantId,
          iceConfig,
          (to, payload) => sendSignal(socket, to, payload),
          {
            onMessage: handleChannelMessage,
            onConnectionChange: (connected) => {
              if (!isCurrentConnection(attempt, socket)) return;
              setConnectedPeers(connected);
              if (connected > 0) requestImageFromPeers(participantId);
            },
          },
        );
        meshRef.current = mesh;
        myIdRef.current = participantId;
        setMyId(participantId);
        setRoom(nextRoom);
        setParticipants(nextParticipants);
        setStatus("接続しました");
        setLoadingProgress({ phase: "idle" });
        mesh.connectToParticipants(nextParticipants);
        window.setTimeout(() => {
          if (isCurrentConnection(attempt, socket)) requestImageFromPeers(participantId);
        }, 400);
      },
      onPeerJoined: (participant, nextParticipants) => {
        if (!isCurrentConnection(attempt, socket)) return;
        setParticipants(nextParticipants);
        meshRef.current?.connectToParticipants(nextParticipants);
        if (imageDataRef.current) sendSnapshot(participant.id);
        else requestImageFromPeers(myIdRef.current);
      },
      onPeerLeft: (participantId, nextParticipants) => {
        if (!isCurrentConnection(attempt, socket)) return;
        setParticipants(nextParticipants);
        setRemoteCursors((current) => current.filter((cursor) => cursor.participantId !== participantId));
        meshRef.current?.disconnect(participantId);
      },
      onSignal: (from, payload) => {
        if (!isCurrentConnection(attempt, socket)) return;
        void meshRef.current?.acceptSignal(from, payload).catch((caught) => {
          if (isCurrentConnection(attempt, socket)) setError(readError(caught));
        });
      },
      onError: (message) => {
        if (isCurrentConnection(attempt, socket)) setError(message);
      },
      onClose: (message) => {
        if (!isCurrentConnection(attempt, socket)) return;
        meshRef.current?.close();
        meshRef.current = null;
        setConnectedPeers(0);
        setStatus("接続が切断されました");
        setLoadingProgress({ phase: "idle" });
        setError(message);
        if (signalingReconnectAttemptsRef.current >= MAX_SIGNALING_RECONNECT_ATTEMPTS) return;
        signalingReconnectAttemptsRef.current += 1;
        signalingReconnectTimerRef.current = window.setTimeout(() => {
          signalingReconnectTimerRef.current = null;
          if (connectionAttemptRef.current === attempt) void enterRoom(normalizedRoomId, { preserveState: true });
        }, SIGNALING_RECONNECT_DELAY_MS);
      },
    });

    socketRef.current = socket;
  }

  async function handleImageUpload(file: File | null) {
    if (!file || !room) return;
    setStatus("画像をブラウザ内でリサイズしています");
    setLoadingProgress({ phase: "resizing", fileName: file.name, sourceBytes: file.size, startedAt: Date.now() });
    const resized = await resizeImage(file);
    const nextLayout = createPuzzleLayout(room.difficulty, resized.width, resized.height);
    const nextPieces = createInitialPieces(nextLayout);
    setImageDataUrl(resized.dataUrl);
    setImageSize({ width: resized.width, height: resized.height });
    setPan({ x: 0, y: 0 });
    setZoom(0.8);
    layoutRef.current = nextLayout;
    piecesRef.current = nextPieces;
    pendingSyncRef.current = null;
    setPieces(nextPieces);
    setStatus("画像を参加者へ配布しています");
    sendSnapshot(undefined, resized.dataUrl, resized.width, resized.height, nextPieces);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    void handleImageUpload(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function handleUploadDragOver(event: React.DragEvent<HTMLElement>) {
    if (!isHost) return;
    event.preventDefault();
  }

  function handleUploadDrop(event: React.DragEvent<HTMLElement>) {
    if (!isHost) return;
    event.preventDefault();
    const file = [...event.dataTransfer.files].find((candidate) => candidate.type.startsWith("image/")) ?? null;
    void handleImageUpload(file);
  }

  function handleChannelMessage(from: string, message: ChannelMessage) {
    switch (message.type) {
      case "request-image":
        if (imageDataRef.current && imageSizeRef.current) sendSnapshot(from);
        break;
      case "image-meta":
        incomingRef.current.set(message.imageId, {
          imageId: message.imageId,
          chunks: Array.from({ length: message.chunks }),
          expected: message.chunks,
          byteLength: message.byteLength,
          width: message.width,
          height: message.height,
        });
        setStatus("画像を受信しています");
        setLoadingProgress({
          phase: "receiving",
          imageId: message.imageId,
          chunksReceived: 0,
          totalChunks: message.chunks,
          byteLength: message.byteLength,
          startedAt: Date.now(),
        });
        break;
      case "image-chunk": {
        const incoming = incomingRef.current.get(message.imageId);
        if (!incoming) return;
        incoming.chunks[message.index] = message.data;
        const chunksReceived = incoming.chunks.filter(Boolean).length;
        setLoadingProgress((current) => ({
          phase: "receiving",
          imageId: message.imageId,
          chunksReceived,
          totalChunks: incoming.expected,
          byteLength: incoming.byteLength,
          startedAt: current.phase === "receiving" && current.imageId === message.imageId ? current.startedAt : Date.now(),
        }));
        setStatus(`画像を受信しています (${chunksReceived}/${incoming.expected})`);
        if (chunksReceived === incoming.expected) {
          const dataUrl = incoming.chunks.join("");
          incomingRef.current.delete(message.imageId);
          setImageDataUrl(dataUrl);
          setImageSize({ width: incoming.width, height: incoming.height });
          const nextLayout = roomRef.current ? createPuzzleLayout(roomRef.current.difficulty, incoming.width, incoming.height) : null;
          if (nextLayout) {
            layoutRef.current = nextLayout;
            setPieces((current) => {
              const base = current.length ? current : createInitialPieces(nextLayout);
              const pendingSync = pendingSyncRef.current;
              if (!pendingSync) {
                piecesRef.current = base;
                return base;
              }
              pendingSyncRef.current = null;
              const nextPieces = mergeSyncedPieces(base, constrainSyncedPieces(pendingSync));
              piecesRef.current = nextPieces;
              return nextPieces;
            });
          }
          setStatus("画像を受信しました");
          setLoadingProgress({ phase: "complete", detail: `${incoming.expected} チャンクを受信しました` });
        }
        break;
      }
      case "piece-move":
        setPieces((current) => {
          const nextPieces = current.map((piece) => {
            if (piece.id !== message.pieceId || piece.locked) return piece;
            const { x, y } = constrainPiecePosition(message.pieceId, message.x, message.y);
            return { ...piece, x, y, z: message.z };
          });
          piecesRef.current = nextPieces;
          return nextPieces;
        });
        break;
      case "piece-lock":
        setPieces((current) => {
          const nextPieces = current.map((piece) => {
            if (piece.id !== message.pieceId) return piece;
            const { x, y } = constrainPiecePosition(message.pieceId, message.x, message.y);
            return { ...piece, x, y, z: message.z, locked: true };
          });
          piecesRef.current = nextPieces;
          return nextPieces;
        });
        break;
      case "piece-front":
        setPieces((current) => {
          const nextPieces = current.map((piece) => {
            if (piece.id !== message.pieceId) return piece;
            return { ...piece, z: message.z };
          });
          piecesRef.current = nextPieces;
          return nextPieces;
        });
        break;
      case "state-sync":
        applySyncedPieces(message.pieces);
        break;
      case "presence":
        setRemoteCursors((current) => {
          if (!message.cursor) return current.filter((cursor) => cursor.participantId !== message.participantId);
          const nextCursor: RemoteCursor = {
            participantId: message.participantId,
            name: message.name,
            x: message.cursor.x,
            y: message.cursor.y,
            seenAt: Date.now(),
          };
          const exists = current.some((cursor) => cursor.participantId === message.participantId);
          return exists ? current.map((cursor) => (cursor.participantId === message.participantId ? nextCursor : cursor)) : [...current, nextCursor];
        });
        break;
    }
  }

  function applySyncedPieces(synced: SyncedPiece[]) {
    setPieces((current) => {
      if (!current.length) {
        pendingSyncRef.current = synced;
        return current;
      }
      pendingSyncRef.current = null;
      const nextPieces = mergeSyncedPieces(current, constrainSyncedPieces(synced));
      piecesRef.current = nextPieces;
      return nextPieces;
    });
  }

  function constrainSyncedPieces(synced: SyncedPiece[]): SyncedPiece[] {
    return synced.map((piece) => {
      const { x, y } = constrainPiecePosition(piece.id, piece.x, piece.y);
      return { ...piece, x, y };
    });
  }

  function constrainPiecePosition(pieceId: number, x: number, y: number): { x: number; y: number } {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_CANVAS_COORDINATE || Math.abs(y) > MAX_CANVAS_COORDINATE) {
      const fallback = piecesRef.current.find((piece) => piece.id === pieceId);
      return { x: fallback?.x ?? 0, y: fallback?.y ?? 0 };
    }
    return { x, y };
  }

  function requestImageFromPeers(participantId = myIdRef.current) {
    if (!participantId || imageDataRef.current) return;
    broadcast({ type: "request-image", participantId });
  }

  function sendSnapshot(to?: string, dataUrl = imageDataRef.current, width = imageSizeRef.current?.width, height = imageSizeRef.current?.height, snapshotPieces = piecesRef.current) {
    sendImage(dataUrl, width, height, to);
    const syncedPieces = snapshotPieces.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    const message: ChannelMessage = { type: "state-sync", pieces: syncedPieces, lockedCount: syncedPieces.filter((piece) => piece.locked).length };
    if (to) meshRef.current?.send(to, message);
    else broadcast(message);
  }

  function sendImage(dataUrl = imageDataRef.current, width = imageSizeRef.current?.width, height = imageSizeRef.current?.height, to?: string) {
    if (!dataUrl || !width || !height) return;
    const imageId = crypto.randomUUID();
    const chunks = chunkString(dataUrl);
    const startedAt = Date.now();
    setLoadingProgress({ phase: "sending", chunksSent: 0, totalChunks: chunks.length, byteLength: dataUrl.length, target: to ? "peer" : "all", startedAt });
    const meta: ChannelMessage = { type: "image-meta", imageId, mimeType: dataUrl.slice(5, dataUrl.indexOf(";")), width, height, chunks: chunks.length, byteLength: dataUrl.length };
    if (to) meshRef.current?.send(to, meta);
    else broadcast(meta);

    chunks.forEach((data, index) => {
      const message: ChannelMessage = { type: "image-chunk", imageId, index, data };
      if (to) meshRef.current?.send(to, message);
      else broadcast(message);
      setLoadingProgress({ phase: "sending", chunksSent: index + 1, totalChunks: chunks.length, byteLength: dataUrl.length, target: to ? "peer" : "all", startedAt });
    });
    setStatus(`画像を配布しました (${chunks.length} チャンク)`);
    setLoadingProgress({ phase: "complete", detail: `${chunks.length} チャンク / ${formatBytes(dataUrl.length)} を配布しました` });
  }

  function broadcast(message: ChannelMessage) {
    meshRef.current?.broadcast(message);
  }

  function publishCursor(cursor: { x: number; y: number } | null, force = false) {
    if (!myId) return;
    const now = Date.now();
    if (!force && now - lastCursorSentAtRef.current < 40) return;
    lastCursorSentAtRef.current = now;
    broadcast({ type: "presence", participantId: myId, name, cursor });
  }

  function bringPieceToFront(pieceId: number): number {
    const nextZ = Math.max(0, ...piecesRef.current.map((piece) => piece.z)) + 1;
    setPieces((current) => {
      const nextPieces = current.map((piece) => (piece.id === pieceId ? { ...piece, z: nextZ } : piece));
      piecesRef.current = nextPieces;
      return nextPieces;
    });
    return nextZ;
  }

  function handlePointerDown(event: React.PointerEvent, piece: BoardPiece) {
    if (!layout || !workspaceMetrics) return;
    const nextZ = bringPieceToFront(piece.id);
    if (piece.locked) {
      broadcast({ type: "piece-front", pieceId: piece.id, z: nextZ, by: myId ?? "local" });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getWorkspacePoint(event);
    if (!pointer) return;
    broadcast({ type: "piece-front", pieceId: piece.id, z: nextZ, by: myId ?? "local" });
    draggingRef.current = {
      id: piece.id,
      dx: pointer.x - (workspaceMetrics.margin + piece.x),
      dy: pointer.y - (workspaceMetrics.margin + piece.y),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerMove(event: React.PointerEvent) {
    const cursor = getWorkspacePoint(event);
    if (cursor) publishCursor(cursor);

    if (panning) {
      setPan({
        x: panning.panX + event.clientX - panning.startX,
        y: panning.panY + event.clientY - panning.startY,
      });
      event.preventDefault();
      return;
    }

    const dragging = draggingRef.current;
    if (!dragging || !layout || !workspaceMetrics) return;
    const pointer = cursor;
    if (!pointer) return;
    const { x, y } = constrainPiecePosition(
      dragging.id,
      pointer.x - dragging.dx - workspaceMetrics.margin,
      pointer.y - dragging.dy - workspaceMetrics.margin,
    );

    setPieces((current) => {
      const nextPieces = current.map((piece) => {
        if (piece.id !== dragging.id || piece.locked) return piece;
        const next = { ...piece, x, y };
        broadcast({ type: "piece-move", pieceId: piece.id, x: next.x, y: next.y, z: next.z, by: myId ?? "local" });
        return next;
      });
      piecesRef.current = nextPieces;
      return nextPieces;
    });
  }

  function handlePointerUp() {
    if (panning) {
      setPanning(null);
      return;
    }
    const dragging = draggingRef.current;
    if (!dragging || !layout) return;
    const threshold = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
    setPieces((current) => {
      const nextPieces = current.map((piece) => {
        if (piece.id !== dragging.id) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) broadcast({ type: "piece-lock", pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z, by: myId ?? "local" });
        return snapped;
      });
      piecesRef.current = nextPieces;
      return nextPieces;
    });
    draggingRef.current = null;
  }

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isLoosePieceEventTarget(event.target)) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPanning({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleViewportPointerLeave() {
    publishCursor(null, true);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!workspaceMetrics) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAtClientPoint(clamp(roundZoom(zoom * factor), MIN_ZOOM, MAX_ZOOM), event.clientX, event.clientY);
  }

  function getWorkspacePoint(event: React.PointerEvent): { x: number; y: number } | null {
    const world = worldRef.current;
    if (!world) return null;
    const rect = viewportRef.current?.getBoundingClientRect() ?? world.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
  }

  function changeZoom(delta: number) {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom((current) => clamp(roundZoom(current + delta), MIN_ZOOM, MAX_ZOOM));
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAtClientPoint(clamp(roundZoom(zoom + delta), MIN_ZOOM, MAX_ZOOM), rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function resetZoom() {
    setZoom(0.8);
    setPan({ x: 0, y: 0 });
  }

  function zoomAtClientPoint(nextZoom: number, clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    if (!viewport || nextZoom === zoom) return;
    const rect = viewport.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    const workspaceX = (viewportX - pan.x) / zoom;
    const workspaceY = (viewportY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({
      x: viewportX - workspaceX * nextZoom,
      y: viewportY - workspaceY * nextZoom,
    });
  }

  function organizePieces() {
    if (!layout) return;
    setPieces((current) => {
      const nextPieces = arrangeLoosePieces(current, layout);
      piecesRef.current = nextPieces;
      const syncedPieces = nextPieces.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      broadcast({ type: "state-sync", pieces: syncedPieces, lockedCount: syncedPieces.filter((piece) => piece.locked).length });
      return nextPieces;
    });
    setStatus("未固定ピースを盤面の下に並べました");
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const isDark = theme === "dark";
  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  if (!viewingRoom) {
    return (
      <main className="home">
        <button
          className="theme-toggle-home"
          onClick={toggleTheme}
          title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <section className="intro">
          <p className="eyebrow">Open Puzzle</p>
          <h1>
            画像を保存しない、<br />
            <em>ブラウザ同士</em>の<br />
            ジグソーパズル。
          </h1>
          <p className="intro-desc">
            部屋を作って画像を選ぶだけで開始できます。画像はリサイズ後に WebRTC で参加者へ配布され、サーバーには保存されません。
          </p>
        </section>

        <section className="start-panel" aria-label="部屋の作成と参加">
          <p className="panel-header">はじめる</p>

          <label>
            表示名
            <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
          </label>

          <div className="field-group">
            <p className="field-label">難易度（ピース数）</p>
            <div className="difficulty" aria-label="難易度">
              {DIFFICULTIES.map((value) => (
                <button key={value} className={difficulty === value ? "selected" : ""} onClick={() => setDifficulty(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button className="primary" onClick={() => void createRoom()}>
            <Play size={16} />
            部屋を作成
          </button>

          <div className="divider"><span>または参加する</span></div>

          <div className="join-row">
            <input
              aria-label="部屋ID"
              placeholder="部屋ID を入力"
              value={joinId}
              onChange={(event) => setJoinId(event.target.value.toUpperCase())}
            />
            <button
              onClick={() => void navigate({ to: "/rooms/$roomId", params: { roomId: joinId.trim().toUpperCase() } })}
              disabled={!joinId.trim()}
            >
              <Link size={16} />
              参加
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-mark">OP</span>
          <div className="room-info">
            <span className="room-id-label">Room</span>
            <strong className="room-id">{room?.id ?? "–"}</strong>
          </div>
        </div>

        <span className="topbar-sep" />

        <div className="topbar-stats">
          <span className="stat-chip">
            <Users size={11} />
            {participants.length}/{MAX_PARTICIPANTS}
          </span>
          <span className="stat-chip">
            <MousePointer2 size={11} />
            {connectedPeers} P2P
          </span>
          <span className="stat-chip">
            {lockedCount}/{pieces.length || room?.difficulty || 0} locked
          </span>
        </div>

        <span className="topbar-spacer" />

        <div className="top-actions">
          <button
            onClick={organizePieces}
            disabled={!layout || !pieces.some((piece) => !piece.locked)}
            title="未固定ピースを盤面の下に並べる"
          >
            <Rows3 size={15} />
            整理
          </button>
          <button onClick={() => void copyShareUrl()} title="共有リンクをコピー">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "コピー済み" : "共有"}
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInputChange} style={{ display: "none" }} />

      <section className="board-wrap">
        {layout && imageDataUrl && workspaceMetrics ? (
          <>
            <div
              ref={viewportRef}
              className={`board-viewport ${panning ? "panning" : ""}`}
              style={{
                backgroundPosition: `${pan.x}px ${pan.y}px`,
                backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
              }}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handleViewportPointerLeave}
              onWheel={handleWheel}
            >
              <div className="board-stage">
                <div
                  ref={worldRef}
                  className="board-world"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                >
                  <div
                    className={`puzzle-frame ${complete ? "complete" : ""}`}
                    style={{
                      left: `${workspaceMetrics.margin}px`,
                      top: `${workspaceMetrics.margin}px`,
                      width: `${layout.boardWidth}px`,
                      height: `${layout.boardHeight}px`,
                    }}
                  />
                  {pieces.map((piece) => {
                    const geometry = layout.pieces[piece.id];
                    return (
                      <button
                        key={piece.id}
                        className={`piece ${piece.locked ? "locked" : ""}`}
                        style={{
                          left: `${workspaceMetrics.margin + piece.x}px`,
                          top: `${workspaceMetrics.margin + piece.y}px`,
                          width: `${layout.pieceWidth}px`,
                          height: `${layout.pieceHeight}px`,
                          zIndex: piece.z,
                        }}
                        aria-label={`piece ${piece.id + 1}`}
                        onPointerDown={(event) => handlePointerDown(event, piece)}
                      >
                        <JigsawPieceImage
                          geometry={geometry}
                          imageDataUrl={imageDataUrl}
                          layout={layout}
                          pieceId={piece.id}
                        />
                      </button>
                    );
                  })}
                  {remoteCursors.map((cursor) => (
                    <div
                      key={cursor.participantId}
                      className="remote-cursor"
                      style={{ left: `${cursor.x}px`, top: `${cursor.y}px` }}
                      title={cursor.name}
                    >
                      <MousePointer2 size={16} />
                      <span>{cursor.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="zoom-controls">
              <button onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title="縮小">
                <Minus size={13} />
              </button>
              <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
              <button onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title="拡大">
                <Plus size={13} />
              </button>
              <button onClick={resetZoom} title="表示をリセット">
                <Maximize2 size={13} />
              </button>
            </div>

            <div className={`canvas-status ${complete ? "complete" : ""}`}>
              {complete ? "完成 ✓" : loadingSummary}
            </div>
          </>
        ) : (
          <div
            className={`empty-board ${isHost ? "drop-target" : ""}`}
            onDragOver={handleUploadDragOver}
            onDrop={handleUploadDrop}
          >
            {isHost ? (
              <>
                <button className="empty-upload-button" onClick={openImagePicker}>
                  <ImagePlus size={18} />
                  画像を選択
                </button>
                <span className="empty-hint">ドラッグ&ドロップ可</span>
                <span className="empty-sub">{loadingSummary}</span>
              </>
            ) : (
              <>
                <Loader2 className="loading-icon" size={28} />
                <div className="loading-copy">
                  <strong>ホストまたは画像を持つ参加者からの配布を待っています</strong>
                  <span>{loadingSummary}</span>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <aside className="people">
        <p className="people-header">参加者</p>
        {participants.map((participant) => (
          <div key={participant.id} className="person">
            <div className="person-avatar">{participant.name.charAt(0)}</div>
            <span>{participant.name}</span>
            {participant.isHost ? <strong className="host-badge">Host</strong> : null}
          </div>
        ))}
      </aside>

      {error ? <p className="toast error">{error}</p> : null}
    </main>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function getRoomIdFromPath(pathname: string): string | null {
  const match = /^\/rooms\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

function describeLoadingProgress(progress: LoadingProgress): string | null {
  switch (progress.phase) {
    case "idle":
      return null;
    case "connecting":
      return `部屋へ接続中 (${formatElapsed(progress.startedAt)})`;
    case "resizing":
      return `画像をリサイズ中: ${progress.fileName} / ${formatBytes(progress.sourceBytes)} (${formatElapsed(progress.startedAt)})`;
    case "sending": {
      const percent = getPercent(progress.chunksSent, progress.totalChunks);
      return `画像を配布中: ${percent}% (${progress.chunksSent}/${progress.totalChunks} チャンク, ${formatBytes(progress.byteLength)})`;
    }
    case "receiving": {
      const percent = getPercent(progress.chunksReceived, progress.totalChunks);
      const remaining = progress.totalChunks - progress.chunksReceived;
      const estimate = estimateRemaining(progress.chunksReceived, progress.totalChunks, progress.startedAt);
      return `画像を受信中: ${percent}% (${progress.chunksReceived}/${progress.totalChunks} チャンク, 残り ${remaining}, 目安 ${estimate}, ${formatBytes(progress.byteLength)})`;
    }
    case "complete":
      return progress.detail;
  }
}

function getPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function estimateRemaining(done: number, total: number, startedAt: number): string {
  if (done <= 0) return "計算中";
  const elapsedSeconds = Math.max(0.1, (Date.now() - startedAt) / 1000);
  const remainingSeconds = Math.max(0, ((total - done) * elapsedSeconds) / done);
  if (remainingSeconds < 1) return "1秒未満";
  if (remainingSeconds < 60) return `約${Math.ceil(remainingSeconds)}秒`;
  return `約${Math.ceil(remainingSeconds / 60)}分`;
}

function formatElapsed(startedAt: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${elapsedSeconds}秒経過`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
}

function JigsawPieceImage({ geometry, imageDataUrl, layout, pieceId }: { geometry: PieceGeometry; imageDataUrl: string; layout: PuzzleLayout; pieceId: number }) {
  const tabSize = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
  const path = createPiecePath(layout.pieceWidth, layout.pieceHeight, geometry.edges, tabSize);

  return (
    <svg
      aria-hidden="true"
      className="piece-svg"
      style={{
        left: `${(-tabSize / layout.pieceWidth) * 100}%`,
        top: `${(-tabSize / layout.pieceHeight) * 100}%`,
        width: `${((layout.pieceWidth + tabSize * 2) / layout.pieceWidth) * 100}%`,
        height: `${((layout.pieceHeight + tabSize * 2) / layout.pieceHeight) * 100}%`,
      }}
      viewBox={`${-tabSize} ${-tabSize} ${layout.pieceWidth + tabSize * 2} ${layout.pieceHeight + tabSize * 2}`}
    >
      <defs>
        <clipPath id={`piece-clip-${pieceId}`}>
          <path d={path} />
        </clipPath>
      </defs>
      <g className="piece-shape" clipPath={`url(#piece-clip-${pieceId})`}>
        <image
          href={imageDataUrl}
          x={-geometry.sourceX}
          y={-geometry.sourceY}
          width={layout.boardWidth}
          height={layout.boardHeight}
          preserveAspectRatio="none"
        />
      </g>
      <path className="piece-edge" d={path} />
    </svg>
  );
}

function createPiecePath(width: number, height: number, edges: PieceGeometry["edges"], tabSize: number): string {
  const commands = [`M 0 0`];
  commands.push(createEdgePath(0, 0, width, 0, edges.top, 0, -1, tabSize));
  commands.push(createEdgePath(width, 0, width, height, edges.right, 1, 0, tabSize));
  commands.push(createEdgePath(width, height, 0, height, edges.bottom, 0, 1, tabSize));
  commands.push(createEdgePath(0, height, 0, 0, edges.left, -1, 0, tabSize));
  commands.push("Z");
  return commands.join(" ");
}

function createEdgePath(startX: number, startY: number, endX: number, endY: number, edge: PieceEdge, normalX: number, normalY: number, tabSize: number): string {
  if (edge === 0) return `L ${roundPath(endX)} ${roundPath(endY)}`;

  const directionX = endX - startX;
  const directionY = endY - startY;
  const offset = edge * tabSize;
  const point = (t: number, normalScale = 0) => {
    const x = startX + directionX * t + normalX * offset * normalScale;
    const y = startY + directionY * t + normalY * offset * normalScale;
    return `${roundPath(x)} ${roundPath(y)}`;
  };

  return [
    `L ${point(0.31)}`,
    `C ${point(0.36)} ${point(0.38, 0.45)} ${point(0.43, 0.48)}`,
    `C ${point(0.44, 1.03)} ${point(0.56, 1.03)} ${point(0.57, 0.48)}`,
    `C ${point(0.62, 0.45)} ${point(0.64)} ${point(0.69)}`,
    `L ${roundPath(endX)} ${roundPath(endY)}`,
  ].join(" ");
}

function roundPath(value: number): number {
  return Math.round(value * 100) / 100;
}

function mergeSyncedPieces(current: BoardPiece[], synced: SyncedPiece[]): BoardPiece[] {
  const byId = new Map(synced.map((piece) => [piece.id, piece]));
  return current.map((piece) => {
    const next = byId.get(piece.id);
    return next ? { ...piece, x: next.x, y: next.y, z: next.z, locked: next.locked } : piece;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const MAX_CANVAS_COORDINATE = 1_000_000_000;

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

function isLoosePieceEventTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest(".piece:not(.locked)"));
}

function arrangeLoosePieces(pieces: BoardPiece[], layout: PuzzleLayout): BoardPiece[] {
  const gap = Math.max(8, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.12);
  const columns = Math.max(1, layout.cols);
  const nextTopZ = Math.max(0, ...pieces.map((piece) => piece.z)) + 1;
  let index = 0;

  return pieces.map((piece) => {
    if (piece.locked) return piece;
    const col = index % columns;
    const row = Math.floor(index / columns);
    index += 1;

    const x = col * (layout.pieceWidth + gap);
    const y = layout.boardHeight + gap + row * (layout.pieceHeight + gap);
    return { ...piece, x, y, z: nextTopZ + index };
  });
}
