import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { AlertCircle } from "lucide-solid";
import {
  createPuzzleLayout,
  getWorkspaceMargin,
} from "@open-jigsaw-puzzle/shared/puzzle";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type {
  ChannelMessage,
  Participant,
  RoomSummary,
} from "@open-jigsaw-puzzle/shared/protocol";
import { sanitizeName } from "@open-jigsaw-puzzle/shared/rooms";
import { useSignaling } from "../hooks/use-signaling";
import { useImageTransfer } from "../hooks/use-image-transfer";
import { usePuzzle } from "../hooks/use-puzzle";
import { useViewport, ZOOM_STEP } from "../hooks/use-viewport";
import { useRemoteCursors } from "../hooks/use-remote-cursors";
import { useImageOverlay } from "../hooks/use-image-overlay";
import { useSettings } from "../hooks/use-settings";
import { describeLoadingProgress } from "../utils/format";
import {
  isAuthorizedPeerMessage,
  isUndoRedoShortcut,
} from "../utils/peer-permissions";
import { SettingsModal } from "./settings-modal";
import { PuzzleBoard } from "./puzzle-board";
import { EmptyBoard } from "./empty-board";
import { CompletionOverlay } from "./completion-overlay";
import { CornerPanelTL } from "./corner-panel-tl";
import { CornerPanelTR } from "./corner-panel-tr";
import { CornerPanelBL } from "./corner-panel-bl";
import { CornerPanelBR } from "./corner-panel-br";
import { toast, workspace } from "./workspace-page.styles";

type Props = {
  roomId: string;
  name: string;
  theme: "light" | "dark";
  onNameConfirmed: (name: string) => void;
  onToggleTheme: () => void;
};

export function WorkspacePage(props: Props) {
  const navigate = useNavigate();
  const [draftName, setDraftName] = createSignal(props.name);
  const [error, setError] = createSignal<string | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const { settings, update: updateSetting, reset: resetSettings } = useSettings();
  const [completionDismissed, setCompletionDismissed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [status, setStatus] = createSignal("画像を選ぶとパズルを開始できます");
  let fileInput: HTMLInputElement | undefined;

  const dispatch = {
    onMessage: (_from: string, _msg: ChannelMessage) => {},
    onHello: (_myId: string, _p: Participant[], _r: RoomSummary) => {},
    onPeerJoined: (_p: Participant, _ps: Participant[]) => {},
    onPeerLeft: (_id: string, _ps: Participant[]) => {},
    onParticipantUpdated: (_p: Participant, _ps: Participant[]) => {},
    onConnectionChange: (_n: number) => {},
    onClose: (_msg: string) => {},
  };

  const signaling = useSignaling(() => props.name, {
    onMessage: (from, msg) => dispatch.onMessage(from, msg),
    onHello: (myId, p, r) => dispatch.onHello(myId, p, r),
    onPeerJoined: (p, ps) => dispatch.onPeerJoined(p, ps),
    onPeerLeft: (id, ps) => dispatch.onPeerLeft(id, ps),
    onParticipantUpdated: (p, ps) => dispatch.onParticipantUpdated(p, ps),
    onConnectionChange: (n) => dispatch.onConnectionChange(n),
    onError: setError,
    onClose: (msg) => dispatch.onClose(msg),
  });

  const imageTransfer = useImageTransfer({
    send: signaling.send,
    broadcast: signaling.broadcast,
    room: signaling.room,
    getPieces: () => puzzle.getPieces(),
    getStartedAtMs: () => puzzle.getStartedAtMs(),
    onImageComplete: (_dataUrl, _w, _h, nextLayout) => {
      setCompletionDismissed(false);
      puzzle.receiveImage(nextLayout);
    },
  });

  const layout = createMemo<PuzzleLayout | null>(() => {
    const room = signaling.room();
    const size = imageTransfer.imageSize();
    if (!room || !size) return null;
    return createPuzzleLayout(room.difficulty, size.width, size.height);
  });

  const margin = createMemo(() => {
    const l = layout();
    return l ? getWorkspaceMargin(l) : 0;
  });

  const cursors = useRemoteCursors({
    myId: signaling.myId,
    name: () => props.name,
    broadcast: signaling.broadcast,
  });

  const myParticipant = createMemo(() =>
    signaling.participants().find((p) => p.id === signaling.myId()),
  );
  const isHost = createMemo(() => myParticipant()?.isHost ?? false);
  const hostId = createMemo(
    () => signaling.participants().find((p) => p.isHost)?.id ?? null,
  );

  const puzzle = usePuzzle({
    broadcast: signaling.broadcast,
    myId: signaling.myId,
    isHost,
    layout,
    onPieceMoved: cursors.markActive,
    onPieceLocked: cursors.clearActive,
  });

  const viewport = useViewport();
  const imageOverlay = useImageOverlay({ broadcast: signaling.broadcast });

  dispatch.onHello = (myId) => {
    setStatus("接続しました");
    imageTransfer.requestImageFromPeers(myId);
    window.setTimeout(() => imageTransfer.requestImageFromPeers(myId), 400);
  };
  dispatch.onPeerJoined = (participant) => {
    if (isHost() && imageTransfer.getImageData()) {
      imageTransfer.sendSnapshot(participant.id);
    } else {
      imageTransfer.requestImageFromPeers(signaling.myId());
    }
    imageOverlay.broadcastCurrentPosition();
  };
  dispatch.onPeerLeft = (participantId) => {
    cursors.removeCursor(participantId);
    puzzle.removeRemoteSelection(participantId);
  };
  dispatch.onParticipantUpdated = (participant) => {
    cursors.updateCursorName(participant.id, participant.name);
    if (participant.id === signaling.myId()) {
      props.onNameConfirmed(participant.name);
      setDraftName(participant.name);
    }
  };
  dispatch.onConnectionChange = (connected) => {
    if (connected > 0) imageTransfer.requestImageFromPeers(signaling.myId());
  };
  dispatch.onClose = (msg) => {
    setError(msg);
    setStatus("接続が切断されました");
  };
  dispatch.onMessage = (from, msg) => {
    if (!isAuthorizedPeerMessage(from, msg, hostId())) return;
    imageTransfer.handleMessage(from, msg);
    puzzle.handleMessage(from, msg);
    cursors.handleMessage(from, msg);
    imageOverlay.handleMessage(from, msg);
  };

  createEffect(() => {
    void signaling.enterRoom(props.roomId);
  });

  createEffect(() => {
    const l = layout();
    if (l) imageOverlay.initPosition(l);
  });

  onMount(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        puzzle.clearSelection();
        return;
      }
      if (!isUndoRedoShortcut(event)) return;
      event.preventDefault();
      const result = event.shiftKey ? puzzle.redoLastMove() : puzzle.undoLastMove();
      if (result === "blocked") {
        setStatus(
          event.shiftKey
            ? "他の参加者が移動したため、この操作はやり直せません"
            : "他の参加者が移動したため、この操作は元に戻せません",
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const isDark = () => props.theme === "dark";
  const loadingSummary = createMemo(
    () => describeLoadingProgress(imageTransfer.loadingProgress()) ?? status(),
  );
  const showCompletion = createMemo(
    () => puzzle.complete() && !completionDismissed(),
  );
  const hasLoosePiece = createMemo(() =>
    puzzle.pieces().some((p) => !p.locked),
  );
  const canOrganize = createMemo(
    () => Boolean(isHost() && layout() && hasLoosePiece()),
  );
  const hasBoard = createMemo(
    () => Boolean(layout() && imageTransfer.imageDataUrl()),
  );

  function updateDisplayName() {
    const me = myParticipant();
    if (!me) return;
    const nextName = sanitizeName(draftName());
    setDraftName(nextName);
    if (nextName === me.name) return;
    signaling.updateName(nextName);
  }

  function handleFileChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = "";
    const room = signaling.room();
    if (!file || !room) return;
    void uploadImage(file, room);
  }

  function handleDragOver(e: DragEvent) {
    if (isHost()) e.preventDefault();
  }

  function handleDrop(e: DragEvent) {
    const room = signaling.room();
    if (!isHost() || !room) return;
    e.preventDefault();
    const file =
      [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/")) ?? null;
    if (file) void uploadImage(file, room);
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
    await navigator.clipboard.writeText(
      `${window.location.origin}/rooms/${props.roomId}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleOrganize() {
    const l = layout();
    if (!l) return;
    if (
      window.confirm("未固定ピースをすべて並べ直します。この操作は元に戻せません。続けますか？")
    ) {
      puzzle.organizePieces(l);
      setStatus("未固定ピースを盤面の下に並べました");
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (viewport.getIsPinching()) return;
    const cursor = viewport.getWorkspacePoint(e);
    if (cursor) cursors.publishCursor(cursor, puzzle.isDragging());
    if (puzzle.handleSelectionBoxMove(e, viewport.getWorkspacePoint)) return;
    if (viewport.handlePanMove(e)) return;
    imageOverlay.handleDragMove(e, viewport.getWorkspacePoint);
    const l = layout();
    if (!l) return;
    puzzle.handleDragMove(
      e,
      viewport.getWorkspacePoint,
      margin(),
      imageOverlay.isDragging() ? undefined : imageOverlay.moveBy,
    );
  }

  function handlePointerUp(e: PointerEvent) {
    const l = layout();
    if (l) {
      const overlayPos = imageOverlay.position();
      const imageOverlayRect = overlayPos
        ? { x: overlayPos.x, y: overlayPos.y, width: l.boardWidth, height: l.boardHeight }
        : null;
      if (puzzle.handleSelectionBoxEnd(l, imageOverlayRect, margin(), e.pointerId)) return;
    }
    if (viewport.handlePanEnd(e.pointerId)) return;
    imageOverlay.handleDragEnd(e.pointerId);
    if (!l) return;
    const threshold = Math.min(l.pieceWidth, l.pieceHeight) * 0.22;
    puzzle.handleDragEnd(threshold, e.pointerId);
  }

  function handleViewportPointerDown(e: PointerEvent) {
    if (viewport.getIsPinching()) {
      e.preventDefault();
      return;
    }
    if (
      layout() &&
      puzzle.handleSelectionBoxPointerDown(e, viewport.getWorkspacePoint)
    )
      return;
    if (e.button === 0 && !e.shiftKey) puzzle.clearSelection();
    viewport.handleViewportPointerDown(e);
  }

  return (
    <main
      class={workspace}
      style={{
        "--piece-edge-opacity-locked": settings().edgeOpacityLocked,
        "--piece-edge-opacity-unlocked": settings().edgeOpacityUnlocked,
        "--piece-edge-opacity-selected": settings().edgeOpacitySelected,
      }}
    >
      <Show
        when={hasBoard()}
        fallback={
          <div
            style={{ position: "absolute", inset: 0 }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <EmptyBoard
              isHost={isHost()}
              statusText={loadingSummary()}
              onPickImage={() => fileInput?.click()}
            />
          </div>
        }
      >
        <PuzzleBoard
          layout={layout()!}
          imageDataUrl={imageTransfer.imageDataUrl()!}
          pieces={puzzle.pieces()}
          zoom={viewport.zoom()}
          pan={viewport.pan()}
          panning={Boolean(viewport.panning())}
          margin={margin()}
          complete={puzzle.complete()}
          remoteCursors={cursors.remoteCursors()}
          activeRemoteCursorIds={cursors.activeRemoteCursorIds()}
          selectedPieceIds={puzzle.selectedPieceIds()}
          imageOverlaySelected={puzzle.imageOverlaySelected()}
          imageOverlayLocked={imageOverlay.locked()}
          imageOverlayOpacity={imageOverlay.opacity()}
          selectionBox={puzzle.selectionBox()}
          remoteSelections={puzzle.remoteSelections()}
          myId={signaling.myId()}
          setViewportEl={viewport.setViewportEl}
          setWorldEl={viewport.setWorldEl}
          getViewportEl={viewport.getViewportEl}
          imageOverlayPosition={imageOverlay.position()}
          onToggleImageLock={() => imageOverlay.toggleLock()}
          onChangeImageOpacity={(v) => imageOverlay.changeOpacity(v)}
          onImageOverlayPointerDown={(e) => {
            if (e.button !== 0) return;
            if (viewport.getIsPinching() || viewport.consumeTouchGestureSuppression(e.pointerId)) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            puzzle.handleImageOverlayPointerDown(e, viewport.getWorkspacePoint);
            if (e.ctrlKey || e.metaKey) return;
            if (!imageOverlay.locked())
              imageOverlay.handlePointerDown(e, viewport.getWorkspacePoint);
          }}
          onPiecePointerDown={(e, piece) => {
            if (viewport.getIsPinching() || viewport.consumeTouchGestureSuppression(e.pointerId)) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            puzzle.handlePointerDown(e, piece, viewport.getWorkspacePoint, margin());
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => cursors.publishCursor(null, true)}
          onViewportPointerDown={handleViewportPointerDown}
          onWheel={viewport.handleWheel}
          onApplyPinch={(f, px, py, nx, ny) =>
            viewport.applyPinch(f, px, py, nx, ny)
          }
          registerPieceElement={puzzle.registerPieceElement}
          onSetPinching={(v) => {
            viewport.setTouchGestureActive(v);
            if (v) {
              imageOverlay.cancelDrag();
              puzzle.cancelDrag();
            }
          }}
        />
      </Show>

      <input
        ref={(el) => (fileInput = el)}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <CornerPanelTL
        roomId={signaling.room()?.id}
        participantCount={signaling.participants().length}
        lockedCount={puzzle.lockedCount()}
        totalPieces={puzzle.pieces().length || signaling.room()?.difficulty || 0}
        onLogoClick={() => {
          if (window.confirm("ホームに戻ります。現在のゲームの進捗は保存されません。続けますか？")) {
            navigate("/");
          }
        }}
      />

      <CornerPanelTR
        participants={signaling.participants()}
        isDark={isDark()}
        copied={copied()}
        onShare={() => void copyShareUrl()}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleTheme={props.onToggleTheme}
      />

      <Show when={canOrganize()}>
        <CornerPanelBL onOrganize={handleOrganize} />
      </Show>

      <Show when={hasBoard()}>
        <CornerPanelBR
          zoom={viewport.zoom()}
          onZoomIn={() => viewport.changeZoom(ZOOM_STEP)}
          onZoomOut={() => viewport.changeZoom(-ZOOM_STEP)}
          onResetZoom={viewport.resetZoom}
        />
      </Show>

      <Show when={error()}>
        <div class={toast}>
          <AlertCircle size={15} />
          {error()}
        </div>
      </Show>

      <Show when={showCompletion()}>
        <CompletionOverlay
          pieceCount={puzzle.pieces().length}
          elapsedMs={puzzle.clearedElapsedMs()}
          onBackToMenu={() => {
            setCompletionDismissed(true);
            navigate("/");
          }}
          onClose={() => setCompletionDismissed(true)}
        />
      </Show>

      <SettingsModal
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
        settings={settings()}
        onChange={updateSetting}
        onReset={resetSettings}
        userName={draftName()}
        onUserNameInput={setDraftName}
        onUserNameCommit={updateDisplayName}
      />
    </main>
  );
}
