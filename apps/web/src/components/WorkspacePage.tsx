import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createPuzzleLayout, getWorkspaceMargin } from "@open-puzzle/shared/puzzle";
import type { PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { ChannelMessage, Participant, RoomSummary } from "@open-puzzle/shared/protocol";
import { sanitizeName } from "@open-puzzle/shared/rooms";
import { useSignaling } from "../hooks/useSignaling";
import { useImageTransfer } from "../hooks/useImageTransfer";
import { usePuzzle } from "../hooks/usePuzzle";
import { useViewport, ZOOM_STEP } from "../hooks/useViewport";
import { useRemoteCursors } from "../hooks/useRemoteCursors";
import { describeLoadingProgress } from "../utils/format";
import { Topbar } from "./Topbar";
import { PuzzleBoard } from "./PuzzleBoard";
import { EmptyBoard } from "./EmptyBoard";
import { Sidebar } from "./Sidebar";
import { CompletionOverlay } from "./CompletionOverlay";

type Props = {
  roomId: string;
  name: string;
  theme: "light" | "dark";
  onNameConfirmed: (name: string) => void;
  onToggleTheme: () => void;
};

export function WorkspacePage({ roomId, name, theme, onNameConfirmed, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const [draftName, setDraftName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCompletion, setShowCompletion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("画像を選ぶとパズルを開始できます");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  //
  // Dispatch refs — assigned after all hooks so callbacks always see the latest hook state.
  // Hooks forward through these refs to break initialization circular dependencies.
  //
  const messageHandlerRef = useRef<(from: string, msg: ChannelMessage) => void>(() => {});
  const signalingHandlerRef = useRef({
    onHello: (_myId: string, _p: Participant[], _r: RoomSummary) => {},
    onPeerJoined: (_p: Participant, _ps: Participant[]) => {},
    onPeerLeft: (_id: string, _ps: Participant[]) => {},
    onParticipantUpdated: (_p: Participant, _ps: Participant[]) => {},
    onConnectionChange: (_n: number) => {},
    onClose: (_msg: string) => {},
  });

  // ── Hooks (order: signaling → imageTransfer → layout → cursors → puzzle → viewport) ──

  const signaling = useSignaling(name, {
    onMessage: (from, msg) => messageHandlerRef.current(from, msg),
    onHello: (myId, p, r) => signalingHandlerRef.current.onHello(myId, p, r),
    onPeerJoined: (p, ps) => signalingHandlerRef.current.onPeerJoined(p, ps),
    onPeerLeft: (id, ps) => signalingHandlerRef.current.onPeerLeft(id, ps),
    onParticipantUpdated: (p, ps) => signalingHandlerRef.current.onParticipantUpdated(p, ps),
    onConnectionChange: (n) => signalingHandlerRef.current.onConnectionChange(n),
    onError: setError,
    onClose: (msg) => signalingHandlerRef.current.onClose(msg),
  });

  // getPieces and onImageComplete reference `puzzle` which is defined below.
  // This is safe: both are closures only invoked from WebSocket callbacks that fire
  // after the component has fully mounted, by which point `puzzle` is initialized.
  const imageTransfer = useImageTransfer({
    send: signaling.send,
    broadcast: signaling.broadcast,
    room: signaling.room,
    getPieces: () => puzzle.piecesRef.current,
    onImageComplete: (_dataUrl, _w, _h, nextLayout: PuzzleLayout) => {
      puzzle.receiveImage(nextLayout);
    },
  });

  const layout = useMemo<PuzzleLayout | null>(() => {
    if (!signaling.room || !imageTransfer.imageSize) return null;
    return createPuzzleLayout(
      signaling.room.difficulty,
      imageTransfer.imageSize.width,
      imageTransfer.imageSize.height,
    );
  }, [signaling.room, imageTransfer.imageSize]);

  const margin = useMemo(() => (layout ? getWorkspaceMargin(layout) : 0), [layout]);

  const cursors = useRemoteCursors({ myId: signaling.myId, name, broadcast: signaling.broadcast });

  const puzzle = usePuzzle({
    broadcast: signaling.broadcast,
    myId: signaling.myId,
    layout,
    onPieceMoved: cursors.markActive,
    onPieceLocked: cursors.clearActive,
  });

  const viewport = useViewport();

  // ── Wire dispatch refs (runs every render; always captures latest hook values) ────

  signalingHandlerRef.current = {
    onHello: (myId) => {
      setStatus("接続しました");
      imageTransfer.requestImageFromPeers(myId);
      window.setTimeout(() => imageTransfer.requestImageFromPeers(myId), 400);
    },
    onPeerJoined: (participant) => {
      if (isHost && imageTransfer.imageDataRef.current) {
        imageTransfer.sendSnapshot(participant.id);
      } else {
        imageTransfer.requestImageFromPeers(signaling.myId);
      }
    },
    onPeerLeft: (participantId) => cursors.removeCursor(participantId),
    onParticipantUpdated: (participant) => {
      cursors.updateCursorName(participant.id, participant.name);
      if (participant.id === signaling.myId) {
        onNameConfirmed(participant.name);
        setDraftName(participant.name);
      }
    },
    onConnectionChange: (connected) => {
      if (connected > 0) imageTransfer.requestImageFromPeers(signaling.myId);
    },
    onClose: (msg) => {
      setError(msg);
      setStatus("接続が切断されました");
    },
  };

  messageHandlerRef.current = (from, msg) => {
    if (!isAuthorizedPeerMessage(from, msg, hostId)) return;
    imageTransfer.handleMessage(from, msg);
    puzzle.handleMessage(from, msg);
    cursors.handleMessage(from, msg);
  };

  // ── Effects ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void signaling.enterRoom(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (puzzle.complete) setShowCompletion(true);
  }, [puzzle.complete]);

  // ── Derived values ────────────────────────────────────────────────────────────────

  const isDark = theme === "dark";
  const myParticipant = signaling.participants.find((p) => p.id === signaling.myId);
  const isHost = myParticipant?.isHost ?? false;
  const hostId = signaling.participants.find((p) => p.isHost)?.id ?? null;
  const nameChanged = Boolean(myParticipant && sanitizeName(draftName) !== myParticipant.name);
  const loadingSummary = describeLoadingProgress(imageTransfer.loadingProgress) ?? status;

  // ── Event handlers ────────────────────────────────────────────────────────────────

  function updateDisplayName() {
    if (!myParticipant) return;
    const nextName = sanitizeName(draftName);
    setDraftName(nextName);
    if (nextName === myParticipant.name) return;
    signaling.updateName(nextName);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !signaling.room) return;
    setStatus("画像を参加者へ配布しています");
    void imageTransfer.handleImageUpload(file, signaling.room);
  }

  function handleDragOver(e: React.DragEvent<HTMLElement>) {
    if (isHost) e.preventDefault();
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    if (!isHost || !signaling.room) return;
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/")) ?? null;
    if (file) void imageTransfer.handleImageUpload(file, signaling.room);
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomId}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleOrganize() {
    if (!layout) return;
    if (window.confirm("未固定ピースをすべて並べ直します。この操作は元に戻せません。続けますか？")) {
      puzzle.organizePieces(layout);
      setStatus("未固定ピースを盤面の下に並べました");
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const cursor = viewport.getWorkspacePoint(e);
    if (cursor) cursors.publishCursor(cursor, Boolean(puzzle.draggingRef.current));
    if (viewport.handlePanMove(e)) return;
    if (!layout) return;
    puzzle.handleDragMove(e, viewport.getWorkspacePoint, margin);
  }

  function handlePointerUp() {
    if (viewport.handlePanEnd()) return;
    if (!layout) return;
    const threshold = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
    puzzle.handleDragEnd(threshold);
  }

  // ── Render ────────────────────────────────────────────────────────────────────────

  return (
    <main className={`workspace${sidebarOpen ? "" : " sidebar-collapsed"}`}>
      <Topbar
        roomId={signaling.room?.id}
        participantCount={signaling.participants.length}
        connectedPeers={signaling.connectedPeers}
        lockedCount={puzzle.lockedCount}
        totalPieces={puzzle.pieces.length}
        difficulty={signaling.room?.difficulty ?? 0}
        isDark={isDark}
        sidebarOpen={sidebarOpen}
        copied={copied}
        canOrganize={Boolean(layout && puzzle.pieces.some((p) => !p.locked))}
        onOrganize={handleOrganize}
        onCopyShareUrl={() => void copyShareUrl()}
        onToggleTheme={onToggleTheme}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <section className="board-wrap">
        {layout && imageTransfer.imageDataUrl ? (
          <PuzzleBoard
            layout={layout}
            imageDataUrl={imageTransfer.imageDataUrl}
            pieces={puzzle.pieces}
            zoom={viewport.zoom}
            pan={viewport.pan}
            panning={Boolean(viewport.panning)}
            margin={margin}
            complete={puzzle.complete}
            loadingSummary={loadingSummary}
            remoteCursors={cursors.remoteCursors}
            activeRemoteCursorIds={cursors.activeRemoteCursorIds}
            myId={signaling.myId}
            viewportRef={viewport.viewportRef}
            worldRef={viewport.worldRef}
            onPiecePointerDown={(e, piece) =>
              puzzle.handlePointerDown(e, piece, viewport.getWorkspacePoint, margin)
            }
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => cursors.publishCursor(null, true)}
            onViewportPointerDown={viewport.handleViewportPointerDown}
            onWheel={viewport.handleWheel}
            onZoomIn={() => viewport.changeZoom(ZOOM_STEP)}
            onZoomOut={() => viewport.changeZoom(-ZOOM_STEP)}
            onResetZoom={viewport.resetZoom}
          />
        ) : (
          <EmptyBoard
            isHost={isHost}
            statusText={loadingSummary}
            onPickImage={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )}
      </section>

      <Sidebar
        myParticipant={myParticipant}
        participants={signaling.participants}
        draftName={draftName}
        onDraftNameChange={setDraftName}
        onDraftNameBlur={() => setDraftName(sanitizeName(draftName))}
        onSaveName={updateDisplayName}
        nameChanged={nameChanged}
      />

      {error ? <p className="toast error">{error}</p> : null}

      {showCompletion && (
        <CompletionOverlay
          pieceCount={puzzle.pieces.length}
          onBackToMenu={() => {
            setShowCompletion(false);
            void navigate({ to: "/" });
          }}
          onClose={() => setShowCompletion(false)}
        />
      )}
    </main>
  );
}

export function isAuthorizedPeerMessage(from: string, msg: ChannelMessage, hostId: string | null): boolean {
  switch (msg.type) {
    case "presence":
      return msg.participantId === from;
    case "request-image":
      return msg.participantId === from;
    case "piece-front":
    case "piece-move":
    case "piece-lock":
      return msg.by === from;
    case "state-sync":
      return true;
    case "image-meta":
    case "image-chunk":
      return hostId === from;
  }
}
