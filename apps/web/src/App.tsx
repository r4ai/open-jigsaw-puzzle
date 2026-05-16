import { Check, Copy, ImagePlus, Link, Loader2, Maximize2, Minus, MousePointer2, Play, Plus, Rows3, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTIES, MAX_PARTICIPANTS, type ChannelMessage, type Difficulty, type Participant, type RoomSummary, type SyncedPiece } from "@open-puzzle/shared/protocol";
import { createInitialPieces, createPuzzleLayout, isComplete, snapPiece, type BoardPiece, type PieceEdge, type PieceGeometry, type PuzzleLayout } from "@open-puzzle/shared/puzzle";
import { chunkString, resizeImage } from "./image";
import { fetchIceConfig, openSignaling, PeerMesh } from "./realtime";

type AppState = "home" | "room";
type IncomingImage = {
  imageId: string;
  chunks: string[];
  expected: number;
  width: number;
  height: number;
};
type DragState = { id: number; dx: number; dy: number };
type PanState = { pointerId: number; startX: number; startY: number; panX: number; panY: number };
type PanOffset = { x: number; y: number };
type WorkspaceMetrics = {
  margin: number;
  width: number;
  height: number;
};

const DEFAULT_NAME = `Player ${Math.floor(Math.random() * 900 + 100)}`;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_FACTOR = 1.12;

export default function App() {
  const [appState, setAppState] = useState<AppState>("home");
  const [name, setName] = useState(DEFAULT_NAME);
  const [joinId, setJoinId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(96);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [status, setStatus] = useState("画像を選ぶとパズルを開始できます");
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const [copied, setCopied] = useState(false);
  const meshRef = useRef<PeerMesh | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const incomingRef = useRef<Map<string, IncomingImage>>(new Map());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const imageDataRef = useRef<string | null>(null);
  const imageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const roomRef = useRef<RoomSummary | null>(null);
  const layoutRef = useRef<PuzzleLayout | null>(null);
  const myIdRef = useRef<string | null>(null);
  const piecesRef = useRef<BoardPiece[]>([]);
  const pendingSyncRef = useRef<SyncedPiece[] | null>(null);

  const layout = useMemo<PuzzleLayout | null>(() => {
    if (!room || !imageSize) return null;
    return createPuzzleLayout(room.difficulty, imageSize.width, imageSize.height);
  }, [imageSize, room]);
  const workspaceMetrics = useMemo<WorkspaceMetrics | null>(() => {
    if (!layout) return null;
    const margin = Math.max(layout.pieceWidth * 2.4, layout.pieceHeight * 2.4, Math.min(layout.boardWidth, layout.boardHeight) * 0.24);
    return {
      margin,
      width: layout.boardWidth + margin * 2,
      height: layout.boardHeight + margin * 2,
    };
  }, [layout]);

  const lockedCount = pieces.filter((piece) => piece.locked).length;
  const complete = isComplete(pieces);
  const isHost = participants.find((participant) => participant.id === myId)?.isHost ?? false;
  const shareUrl = room ? `${window.location.origin}/?room=${room.id}` : "";

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const roomId = query.get("room");
    if (roomId) setJoinId(roomId.toUpperCase());
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
      meshRef.current?.close();
    };
  }, []);

  useEffect(() => {
    imageDataRef.current = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    imageSizeRef.current = imageSize;
  }, [imageSize]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  async function createRoom() {
    setError(null);
    setStatus("部屋を作成しています");
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ difficulty }),
    });
    const payload = (await response.json()) as { room?: RoomSummary; error?: string };
    if (!response.ok || !payload.room) {
      setError(payload.error ?? "部屋を作成できませんでした");
      return;
    }
    await enterRoom(payload.room.id);
  }

  async function enterRoom(roomId: string) {
    setError(null);
    setStatus("部屋へ接続しています");
    const iceConfig = await fetchIceConfig();

    socketRef.current?.close();
    meshRef.current?.close();
    pendingSyncRef.current = null;

    const socket = openSignaling(roomId.trim().toUpperCase(), name, {
      onHello: (participantId, nextParticipants, nextRoom) => {
        const mesh = new PeerMesh(
          participantId,
          iceConfig,
          (to, payload) => socket.send(JSON.stringify({ type: "signal", to, payload })),
          {
            onMessage: handleChannelMessage,
            onConnectionChange: (connected) => {
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
        setAppState("room");
        setStatus("接続しました");
        mesh.connectToParticipants(nextParticipants);
        setTimeout(() => requestImageFromPeers(participantId), 400);
      },
      onPeerJoined: (participant, nextParticipants) => {
        setParticipants(nextParticipants);
        meshRef.current?.connectToParticipants(nextParticipants);
        if (imageDataRef.current) sendSnapshot(participant.id);
        else requestImageFromPeers(myIdRef.current);
      },
      onPeerLeft: (participantId, nextParticipants) => {
        setParticipants(nextParticipants);
        meshRef.current?.disconnect(participantId);
      },
      onSignal: (from, payload) => {
        void meshRef.current?.acceptSignal(from, payload).catch((caught) => setError(readError(caught)));
      },
      onError: setError,
    });

    socketRef.current = socket;
  }

  async function handleImageUpload(file: File | null) {
    if (!file || !room) return;
    setStatus("画像をブラウザ内でリサイズしています");
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
          width: message.width,
          height: message.height,
        });
        setStatus("画像を受信しています");
        break;
      case "image-chunk": {
        const incoming = incomingRef.current.get(message.imageId);
        if (!incoming) return;
        incoming.chunks[message.index] = message.data;
        if (incoming.chunks.filter(Boolean).length === incoming.expected) {
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
        }
        break;
      }
      case "piece-move":
        setPieces((current) => {
          const nextPieces = current.map((piece) => {
            if (piece.id !== message.pieceId || piece.locked) return piece;
            const { x, y } = constrainPiecePosition(message.pieceId, message.x, message.y);
            return { ...piece, x, y };
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
            return { ...piece, x, y, locked: true };
          });
          piecesRef.current = nextPieces;
          return nextPieces;
        });
        break;
      case "state-sync":
        applySyncedPieces(message.pieces);
        break;
      case "presence":
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
    const currentLayout = layoutRef.current;
    if (!currentLayout || !Number.isFinite(x) || !Number.isFinite(y)) {
      const fallback = piecesRef.current.find((piece) => piece.id === pieceId);
      return { x: fallback?.x ?? 0, y: fallback?.y ?? 0 };
    }
    return {
      x: clamp(x, -getWorkspaceMargin(currentLayout), currentLayout.boardWidth + getWorkspaceMargin(currentLayout) - currentLayout.pieceWidth),
      y: clamp(y, -getWorkspaceMargin(currentLayout), currentLayout.boardHeight + getWorkspaceMargin(currentLayout) - currentLayout.pieceHeight),
    };
  }

  function requestImageFromPeers(participantId = myIdRef.current) {
    if (!participantId || imageDataRef.current) return;
    broadcast({ type: "request-image", participantId });
  }

  function sendSnapshot(to?: string, dataUrl = imageDataRef.current, width = imageSizeRef.current?.width, height = imageSizeRef.current?.height, snapshotPieces = piecesRef.current) {
    sendImage(dataUrl, width, height, to);
    const syncedPieces = snapshotPieces.map(({ id, x, y, locked }) => ({ id, x, y, locked }));
    const message: ChannelMessage = { type: "state-sync", pieces: syncedPieces, lockedCount: syncedPieces.filter((piece) => piece.locked).length };
    if (to) meshRef.current?.send(to, message);
    else broadcast(message);
  }

  function sendImage(dataUrl = imageDataRef.current, width = imageSizeRef.current?.width, height = imageSizeRef.current?.height, to?: string) {
    if (!dataUrl || !width || !height) return;
    const imageId = crypto.randomUUID();
    const chunks = chunkString(dataUrl);
    const meta: ChannelMessage = { type: "image-meta", imageId, mimeType: dataUrl.slice(5, dataUrl.indexOf(";")), width, height, chunks: chunks.length, byteLength: dataUrl.length };
    if (to) meshRef.current?.send(to, meta);
    else broadcast(meta);

    chunks.forEach((data, index) => {
      const message: ChannelMessage = { type: "image-chunk", imageId, index, data };
      if (to) meshRef.current?.send(to, message);
      else broadcast(message);
    });
    setStatus("画像を配布しました");
  }

  function broadcast(message: ChannelMessage) {
    meshRef.current?.broadcast(message);
  }

  function handlePointerDown(event: React.PointerEvent, piece: BoardPiece) {
    if (piece.locked || !layout || !workspaceMetrics) return;
    const pointer = getWorkspacePoint(event);
    if (!pointer) return;
    setDragging({
      id: piece.id,
      dx: pointer.x - (workspaceMetrics.margin + piece.x),
      dy: pointer.y - (workspaceMetrics.margin + piece.y),
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (panning) {
      setPan({
        x: panning.panX + event.clientX - panning.startX,
        y: panning.panY + event.clientY - panning.startY,
      });
      event.preventDefault();
      return;
    }

    if (!dragging || !layout || !workspaceMetrics) return;
    const pointer = getWorkspacePoint(event);
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
        broadcast({ type: "piece-move", pieceId: piece.id, x: next.x, y: next.y, by: myId ?? "local" });
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
    if (!dragging || !layout) return;
    const threshold = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
    setPieces((current) => {
      const nextPieces = current.map((piece) => {
        if (piece.id !== dragging.id) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) broadcast({ type: "piece-lock", pieceId: snapped.id, x: snapped.x, y: snapped.y, by: myId ?? "local" });
        return snapped;
      });
      piecesRef.current = nextPieces;
      return nextPieces;
    });
    setDragging(null);
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
      const syncedPieces = nextPieces.map(({ id, x, y, locked }) => ({ id, x, y, locked }));
      broadcast({ type: "state-sync", pieces: syncedPieces, lockedCount: syncedPieces.filter((piece) => piece.locked).length });
      return nextPieces;
    });
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (appState === "home") {
    return (
      <main className="shell home">
        <section className="intro">
          <div>
            <p className="eyebrow">Open Puzzle</p>
            <h1>画像を保存しない、ブラウザ同士のジグソーパズル</h1>
          </div>
          <p>部屋を作って画像を選ぶだけで開始できます。画像はリサイズ後に WebRTC で参加者へ配布され、サーバーには保存されません。</p>
        </section>

        <section className="start-panel" aria-label="部屋の作成と参加">
          <label>
            表示名
            <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
          </label>

          <div className="difficulty" aria-label="難易度">
            {DIFFICULTIES.map((value) => (
              <button key={value} className={difficulty === value ? "selected" : ""} onClick={() => setDifficulty(value)}>
                {value}
              </button>
            ))}
          </div>

          <button className="primary" onClick={() => void createRoom()}>
            <Play size={18} />
            部屋を作成
          </button>

          <div className="join-row">
            <input aria-label="部屋ID" placeholder="部屋ID" value={joinId} onChange={(event) => setJoinId(event.target.value.toUpperCase())} />
            <button onClick={() => void enterRoom(joinId)} disabled={!joinId.trim()}>
              <Link size={18} />
              参加
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room {room?.id}</p>
          <h1>{room?.difficulty} pieces</h1>
        </div>
        <div className="top-actions">
          <button onClick={organizePieces} disabled={!layout || !pieces.some((piece) => !piece.locked)} title="未固定のピースを整理">
            <Rows3 size={18} />
            整理
          </button>
          <button onClick={() => void copyShareUrl()} title="共有リンクをコピー">
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "コピー済み" : "共有"}
          </button>
          <label className="upload">
            <ImagePlus size={18} />
            画像
            <input type="file" accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </header>

      <section className="status-grid">
        <div><Users size={16} /> {participants.length}/{MAX_PARTICIPANTS}</div>
        <div><MousePointer2 size={16} /> P2P {connectedPeers}</div>
        <div>{lockedCount}/{pieces.length || room?.difficulty || 0} locked</div>
        <div>{complete ? "完成" : status}</div>
      </section>

      <section className="tool-strip" aria-label="表示操作">
        <button onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title="縮小">
          <Minus size={18} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title="拡大">
          <Plus size={18} />
        </button>
        <button onClick={resetZoom} title="表示をリセット">
          <Maximize2 size={18} />
        </button>
      </section>

      <section className="board-wrap">
        {layout && imageDataUrl && workspaceMetrics ? (
          <div
            ref={viewportRef}
            className={`board-viewport ${panning ? "panning" : ""}`}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <div
              className="board-stage"
              style={{
                width: `${workspaceMetrics.width * zoom}px`,
                height: `${workspaceMetrics.height * zoom}px`,
              }}
            >
              <div
                ref={worldRef}
                className="board-world"
                style={{
                  width: `${workspaceMetrics.width}px`,
                  height: `${workspaceMetrics.height}px`,
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
                        zIndex: piece.locked ? 1 : dragging?.id === piece.id ? 5 : 2,
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
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-board">
            <Loader2 size={24} />
            <span>{isHost ? "画像を選択してください" : "ホストまたは画像を持つ参加者からの配布を待っています"}</span>
          </div>
        )}
      </section>

      <aside className="people">
        {participants.map((participant) => (
          <div key={participant.id} className="person">
            <span>{participant.name}</span>
            {participant.isHost ? <strong>Host</strong> : null}
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
    return next ? { ...piece, x: next.x, y: next.y, locked: next.locked } : piece;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWorkspaceMargin(layout: PuzzleLayout): number {
  return Math.max(layout.pieceWidth * 2.4, layout.pieceHeight * 2.4, Math.min(layout.boardWidth, layout.boardHeight) * 0.24);
}

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

function isLoosePieceEventTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest(".piece:not(.locked)"));
}

function arrangeLoosePieces(pieces: BoardPiece[], layout: PuzzleLayout): BoardPiece[] {
  const margin = getWorkspaceMargin(layout);
  const gap = Math.max(8, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.12);
  const columns = Math.max(1, Math.floor((layout.boardWidth + margin * 2 + gap) / (layout.pieceWidth + gap)));
  let index = 0;

  return pieces.map((piece) => {
    if (piece.locked) return piece;
    const col = index % columns;
    const row = Math.floor(index / columns);
    index += 1;

    const x = -margin + gap + col * (layout.pieceWidth + gap);
    const y = layout.boardHeight + gap + row * (layout.pieceHeight + gap);
    const constrained = {
      x: clamp(x, -margin, layout.boardWidth + margin - layout.pieceWidth),
      y: clamp(y, -margin, layout.boardHeight + margin - layout.pieceHeight),
    };
    return { ...piece, ...constrained };
  });
}
