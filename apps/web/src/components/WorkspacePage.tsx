import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createPuzzleLayout, getWorkspaceMargin } from "@open-jigsaw-puzzle/shared/puzzle";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, Participant, RoomSummary } from "@open-jigsaw-puzzle/shared/protocol";
import { sanitizeName } from "@open-jigsaw-puzzle/shared/rooms";
import { useSignaling } from "../hooks/useSignaling";
import { useImageTransfer } from "../hooks/useImageTransfer";
import { usePuzzle } from "../hooks/usePuzzle";
import { useViewport, ZOOM_STEP } from "../hooks/useViewport";
import { useRemoteCursors } from "../hooks/useRemoteCursors";
import { useImageOverlay } from "../hooks/useImageOverlay";
import { useSettings } from "../hooks/useSettings";
import { describeLoadingProgress } from "../utils/format";
import { SettingsModal } from "./SettingsModal";
import { Topbar } from "./Topbar";
import { PuzzleBoard } from "./PuzzleBoard";
import { EmptyBoard } from "./EmptyBoard";
import { Sidebar } from "./Sidebar";
import { CompletionOverlay } from "./CompletionOverlay";
import styles from "./WorkspacePage.module.css";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update: updateSetting, reset: resetSettings } = useSettings();
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
    getStartedAtMs: () => puzzle.startedAtMsRef.current,
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

  const myParticipant = signaling.participants.find((p) => p.id === signaling.myId);
  const isHost = myParticipant?.isHost ?? false;
  const hostId = signaling.participants.find((p) => p.isHost)?.id ?? null;

  const puzzle = usePuzzle({
    broadcast: signaling.broadcast,
    myId: signaling.myId,
    isHost,
    layout,
    onPieceMoved: cursors.markActive,
    onPieceLocked: cursors.clearActive,
  });
  const clearSelectionRef = useRef<() => void>(() => {});
  clearSelectionRef.current = puzzle.clearSelection;

  const viewport = useViewport();

  const imageOverlay = useImageOverlay({ broadcast: signaling.broadcast });

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
      imageOverlay.broadcastCurrentPosition();
    },
    onPeerLeft: (participantId) => {
      cursors.removeCursor(participantId);
      puzzle.removeRemoteSelection(participantId);
    },
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
    imageOverlay.handleMessage(from, msg);
  };

  // ── Effects ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    void signaling.enterRoom(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (puzzle.complete) setShowCompletion(true);
    else setShowCompletion(false);
  }, [puzzle.complete]);

  useEffect(() => {
    if (layout) imageOverlay.initPosition(layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearSelectionRef.current();
        return;
      }
      if (!isUndoRedoShortcut(event)) return;
      event.preventDefault();
      const result = event.shiftKey ? puzzle.redoLastMove() : puzzle.undoLastMove();
      if (result === "blocked") {
        setStatus(event.shiftKey ? "他の参加者が移動したため、この操作はやり直せません" : "他の参加者が移動したため、この操作は元に戻せません");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [puzzle]);

  // ── Derived values ────────────────────────────────────────────────────────────────

  const isDark = theme === "dark";
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
    void uploadImage(file, signaling.room);
  }

  function handleDragOver(e: React.DragEvent<HTMLElement>) {
    if (isHost) e.preventDefault();
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    if (!isHost || !signaling.room) return;
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/")) ?? null;
    if (file) void uploadImage(file, signaling.room);
  }

  async function uploadImage(file: File, currentRoom: RoomSummary) {
    setStatus("画像を参加者へ配布しています");
    setError(null);
    try {
      await imageTransfer.handleImageUpload(file, currentRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像の読み込みに失敗しました。");
      setStatus("画像の読み込みに失敗しました");
    }
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
    if (viewport.isPinchingRef.current) return;
    const cursor = viewport.getWorkspacePoint(e);
    if (cursor) cursors.publishCursor(cursor, Boolean(puzzle.draggingRef.current));
    if (puzzle.handleSelectionBoxMove(e, viewport.getWorkspacePoint)) return;
    if (viewport.handlePanMove(e)) return;
    imageOverlay.handleDragMove(e, viewport.getWorkspacePoint);
    if (!layout) return;
    puzzle.handleDragMove(
      e,
      viewport.getWorkspacePoint,
      margin,
      imageOverlay.draggingRef.current ? undefined : imageOverlay.moveBy,
    );
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (layout) {
      const imageOverlayRect = imageOverlay.position
        ? { x: imageOverlay.position.x, y: imageOverlay.position.y, width: layout.boardWidth, height: layout.boardHeight }
        : null;
      if (puzzle.handleSelectionBoxEnd(layout, imageOverlayRect, margin, e.pointerId)) return;
    }
    if (viewport.handlePanEnd(e.pointerId)) return;
    imageOverlay.handleDragEnd(e.pointerId);
    if (!layout) return;
    const threshold = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
    puzzle.handleDragEnd(threshold, e.pointerId);
  }

  function handleViewportPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (viewport.isPinchingRef.current) {
      e.preventDefault();
      return;
    }
    if (layout && puzzle.handleSelectionBoxPointerDown(e, viewport.getWorkspacePoint)) return;
    if (e.button === 0 && !e.shiftKey) puzzle.clearSelection();
    viewport.handleViewportPointerDown(e);
  }

  // ── Render ────────────────────────────────────────────────────────────────────────

  return (
    <main
      className={`${styles.workspace} ${!sidebarOpen ? styles.sidebarCollapsed : ""}`}
      style={{
        "--piece-edge-opacity-locked": settings.edgeOpacityLocked,
        "--piece-edge-opacity-unlocked": settings.edgeOpacityUnlocked,
        "--piece-edge-opacity-selected": settings.edgeOpacitySelected,
      } as React.CSSProperties}
    >
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
        canOrganize={Boolean(isHost && layout && puzzle.pieces.some((p) => !p.locked))}
        onOrganize={handleOrganize}
        onCopyShareUrl={() => void copyShareUrl()}
        onToggleTheme={onToggleTheme}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSetting}
        onReset={resetSettings}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <section className={styles.boardWrap}>
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
            selectedPieceIds={puzzle.selectedPieceIds}
            imageOverlaySelected={puzzle.imageOverlaySelected}
            imageOverlayLocked={imageOverlay.locked}
            imageOverlayOpacity={imageOverlay.opacity}
            selectionBox={puzzle.selectionBox}
            remoteSelections={puzzle.remoteSelections}
            myId={signaling.myId}
            viewportRef={viewport.viewportRef}
            worldRef={viewport.worldRef}
            imageOverlayPosition={imageOverlay.position}
            onToggleImageLock={() => imageOverlay.toggleLock()}
            onChangeImageOpacity={(v) => imageOverlay.changeOpacity(v)}
            onImageOverlayPointerDown={(e) => {
              if (e.button !== 0) return;
              puzzle.handleImageOverlayPointerDown(e, viewport.getWorkspacePoint);
              if (e.ctrlKey || e.metaKey) return;
              if (!imageOverlay.locked) imageOverlay.handlePointerDown(e, viewport.getWorkspacePoint);
            }}
            onPiecePointerDown={(e, piece) =>
              puzzle.handlePointerDown(e, piece, viewport.getWorkspacePoint, margin)
            }
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => cursors.publishCursor(null, true)}
            onViewportPointerDown={handleViewportPointerDown}
            onWheel={viewport.handleWheel}
            onZoomIn={() => viewport.changeZoom(ZOOM_STEP)}
            onZoomOut={() => viewport.changeZoom(-ZOOM_STEP)}
            onResetZoom={viewport.resetZoom}
            onApplyPinch={(f, px, py, nx, ny) => viewport.applyPinch(f, px, py, nx, ny)}
            onSetPinching={(v) => {
              viewport.isPinchingRef.current = v;
              if (v) {
                viewport.cancelPan();
                imageOverlay.handleDragEnd();
                if (layout) {
                  const threshold = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
                  puzzle.handleDragEnd(threshold);
                }
              }
            }}
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
        sidebarOpen={sidebarOpen}
        onDraftNameChange={setDraftName}
        onDraftNameBlur={() => setDraftName(sanitizeName(draftName))}
        onSaveName={updateDisplayName}
        nameChanged={nameChanged}
      />

      {error ? <p className={styles.toast}>{error}</p> : null}

      {showCompletion && (
        <CompletionOverlay
          pieceCount={puzzle.pieces.length}
          elapsedMs={puzzle.clearedElapsedMs}
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
    case "piece-moves":
    case "piece-lock":
      return msg.by === from;
    case "selection-presence":
      return msg.participantId === from;
    case "state-sync":
    case "image-overlay":
      return hostId === from;
    case "puzzle-completed":
      return msg.by === from && hostId === from;
    case "image-meta":
    case "image-chunk":
      return hostId === from;
  }
}

export function isUndoRedoShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== "z") return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.altKey) return false;
  const target = event.target;
  return !(target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']"));
}
