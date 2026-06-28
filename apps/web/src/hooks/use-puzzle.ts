import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import {
  createInitialPieces,
  isComplete,
  snapPiece,
} from "@open-jigsaw-puzzle/shared/puzzle";
import type {
  BoardPiece,
  PuzzleLayout,
} from "@open-jigsaw-puzzle/shared/puzzle";
import type {
  ChannelMessage,
  SyncedPiece,
} from "@open-jigsaw-puzzle/shared/protocol";
import {
  arrangeLoosePieces,
  bringSelectedPiecesToFront,
  countLockedPieces,
  createEmptySelection,
  getConnectedLoosePieceIds,
  MAX_CANVAS_COORDINATE,
  mergeSyncedPieces,
  normalizeRect,
  selectByRect,
  selectOnlyImageOverlay,
  selectOnlyPiece,
  snapLoosePiecesToNeighbors,
  toggleImageOverlaySelection,
  togglePieceSelection,
  addPieceRangeSelection,
  updatePieceById,
} from "../utils/puzzle-ops";
import type { Rect, SelectionState } from "../utils/puzzle-ops";
import {
  applyPieceSnapshots,
  createMoveHistoryEntry,
  createPieceHistory,
  type HistoryResult,
  type PieceHistorySnapshot,
} from "../utils/puzzle-history";
import {
  TOUCH_DRAG_THRESHOLD_PX,
  type BatchedPieceLock,
  type BatchedPieceMove,
  type DragState,
  type PendingDragMove,
  type RemoteSelection,
  type SelectionBoxState,
} from "./puzzle/types";
import { reduceMessage, type SyncCommand } from "./puzzle/message-reducer";

export type { RemoteSelection };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  isHost: () => boolean;
  layout: () => PuzzleLayout | null;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
};

/**
 * The core puzzle hook: owns the piece array, selection state, drag handling,
 * undo/redo history, and the realtime message dispatcher that keeps every
 * participant's board consistent.
 */
export function usePuzzle(props: Props) {
  const [pieces, setPieces] = createSignal<BoardPiece[]>([]);
  const [selectedPieceIds, setSelectedPieceIds] = createSignal<Set<number>>(new Set());
  const [imageOverlaySelected, setImageOverlaySelected] = createSignal(false);
  const [selectionBox, setSelectionBox] = createSignal<Rect | null>(null);
  const [remoteSelections, setRemoteSelections] = createSignal<RemoteSelection[]>([]);
  const [clearedElapsedMs, setClearedElapsedMs] = createSignal<number | null>(null);

  let startedAtMs: number | null = null;
  let clearedElapsedMsNow: number | null = null;
  let piecesNow: BoardPiece[] = [];
  let pendingSync: SyncedPiece[] | null = null;
  let dragging: DragState | null = null;
  let pendingDragMove: PendingDragMove | null = null;
  let dragFrame: number | null = null;
  let pendingSelectionPresence: { pieceIds: Set<number>; imageOverlaySelected: boolean } | null = null;
  let selectionPresenceFrame: number | null = null;
  const pieceElements = new Map<number, HTMLElement>();
  const livePieceTransforms = new Map<number, { x: number; y: number }>();
  let dragMargin = 0;
  let selectedPieceIdsNow = new Set<number>();
  let imageOverlaySelectedNow = false;
  let lastSelectedPieceId: number | null = null;
  let selectionBoxNow: SelectionBoxState | null = null;
  const history = createPieceHistory();
  let remoteMoveVersion = 0;

  onCleanup(() => {
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
    if (selectionPresenceFrame !== null) cancelAnimationFrame(selectionPresenceFrame);
  });

  function registerPieceElement(id: number, el: HTMLElement | null) {
    if (el) pieceElements.set(id, el);
    else pieceElements.delete(id);
  }

  function setPieceDomTransform(id: number, x: number, y: number) {
    const el = pieceElements.get(id);
    if (!el) return;
    el.style.transform = `translate3d(${dragMargin + x}px, ${dragMargin + y}px, 0)`;
  }

  function constrainPosition(pieceId: number, x: number, y: number): { x: number; y: number } {
    if (
      !Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > MAX_CANVAS_COORDINATE || Math.abs(y) > MAX_CANVAS_COORDINATE
    ) {
      const fallback = piecesNow[pieceId];
      return { x: fallback?.x ?? 0, y: fallback?.y ?? 0 };
    }
    return { x, y };
  }

  function updatePieces(updater: (cur: BoardPiece[]) => BoardPiece[]) {
    setPieces((cur) => {
      const next = updater(cur);
      piecesNow = next;
      return next;
    });
  }

  function publishSelectionNow(pieceIds: Set<number>, imageSelected: boolean) {
    const participantId = props.myId();
    if (!participantId) return;
    props.broadcast({
      type: "selection-presence",
      participantId,
      pieceIds: [...pieceIds].sort((a, b) => a - b),
      imageOverlaySelected: imageSelected,
    });
  }

  function publishSelection(pieceIds = selectedPieceIdsNow, imageSelected = imageOverlaySelectedNow) {
    pendingSelectionPresence = { pieceIds, imageOverlaySelected: imageSelected };
    if (selectionPresenceFrame !== null) return;
    selectionPresenceFrame = requestAnimationFrame(() => {
      selectionPresenceFrame = null;
      const pending = pendingSelectionPresence;
      pendingSelectionPresence = null;
      if (!pending) return;
      publishSelectionNow(pending.pieceIds, pending.imageOverlaySelected);
    });
  }

  function publishPieceMoves(moves: BatchedPieceMove[]) {
    const by = props.myId() ?? "local";
    if (moves.length === 0) return;
    if (moves.length === 1) {
      const move = moves[0]!;
      props.broadcast({ type: "piece-move", ...move, by });
      return;
    }
    props.broadcast({ type: "piece-moves", moves, by });
  }

  function publishPieceLocks(locks: BatchedPieceLock[]) {
    const by = props.myId() ?? "local";
    if (locks.length === 0) return;
    if (locks.length === 1) {
      const lock = locks[0]!;
      props.broadcast({ type: "piece-lock", ...lock, by });
      return;
    }
    props.broadcast({ type: "piece-locks", locks, by });
  }

  function setSelection(next: SelectionState) {
    selectedPieceIdsNow = next.pieceIds;
    imageOverlaySelectedNow = next.imageOverlaySelected;
    lastSelectedPieceId = next.lastSelectedPieceId;
    setSelectedPieceIds(next.pieceIds);
    setImageOverlaySelected(next.imageOverlaySelected);
    publishSelection(next.pieceIds, next.imageOverlaySelected);
  }

  function rememberMove(startPieces: Map<number, BoardPiece>, nextPieces: BoardPiece[]) {
    history.remember(createMoveHistoryEntry(startPieces.values(), nextPieces, remoteMoveVersion));
  }

  function applyHistorySnapshots(snapshots: PieceHistorySnapshot[]) {
    updatePieces((cur) => {
      const next = applyPieceSnapshots(cur, snapshots);
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      props.broadcast({
        type: "state-sync",
        pieces: synced,
        lockedCount: countLockedPieces(synced),
        by: props.myId() ?? "local",
        startedAtMs,
      });
      return next;
    });
  }

  function undoLastMove(): HistoryResult {
    const { result, snapshots } = history.undo(remoteMoveVersion);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function redoLastMove(): HistoryResult {
    const { result, snapshots } = history.redo(remoteMoveVersion);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function clearMoveHistory(resetRemoteVersion = false) {
    history.clear();
    if (resetRemoteVersion) remoteMoveVersion = 0;
  }

  function clearSelection() {
    setSelection(createEmptySelection());
  }

  function currentSelection(): SelectionState {
    return {
      pieceIds: selectedPieceIdsNow,
      imageOverlaySelected: imageOverlaySelectedNow,
      lastSelectedPieceId,
    };
  }

  function bringToFront(pieceId: number): number {
    const nextZ = Math.max(0, ...piecesNow.map((p) => p.z)) + 1;
    updatePieces((cur) => updatePieceById(cur, pieceId, (p) => ({ ...p, z: nextZ })));
    return nextZ;
  }

  function bringSelectionToFront(pieceIds: Set<number>) {
    const before = piecesNow;
    const next = bringSelectedPiecesToFront(before, pieceIds);
    if (next === before) return;
    piecesNow = next;
    setPieces(next);
    const beforeById = new Map(before.map((piece) => [piece.id, piece]));
    for (const piece of next) {
      const previous = beforeById.get(piece.id);
      if (previous && previous.z !== piece.z) {
        props.broadcast({ type: "piece-front", pieceId: piece.id, z: piece.z, by: props.myId() ?? "local" });
      }
    }
  }

  function resetTimer() {
    startedAtMs = null;
    clearedElapsedMsNow = null;
    setClearedElapsedMs(null);
  }

  function setNewPieces(newLayout: PuzzleLayout) {
    const nextPieces = createInitialPieces(newLayout);
    piecesNow = nextPieces;
    pendingSync = null;
    clearMoveHistory(true);
    resetTimer();
    setPieces(nextPieces);
  }

  function receiveImage(nextLayout: PuzzleLayout) {
    setPieces(() => {
      const base = createInitialPieces(nextLayout);
      const pending = pendingSync;
      pendingSync = null;
      clearMoveHistory(true);
      resetTimer();
      if (!pending) {
        piecesNow = base;
        return base;
      }
      const constrained = pending.map((p) => {
        const { x, y } = constrainPosition(p.id, p.x, p.y);
        return { ...p, x, y };
      });
      const next = mergeSyncedPieces(base, constrained);
      piecesNow = next;
      return next;
    });
  }

  function applySyncedPieces(synced: SyncedPiece[]) {
    const constrained = synced.map((p) => {
      const { x, y } = constrainPosition(p.id, p.x, p.y);
      return { ...p, x, y };
    });
    setPieces((cur) => {
      if (!cur.length) {
        pendingSync = constrained;
        return cur;
      }
      pendingSync = null;
      const next = mergeSyncedPieces(cur, constrained);
      piecesNow = next;
      return next;
    });
  }

  function organizePieces(currentLayout: PuzzleLayout) {
    setPieces((cur) => {
      clearMoveHistory();
      const next = arrangeLoosePieces(cur, currentLayout);
      piecesNow = next;
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      props.broadcast({
        type: "state-sync",
        pieces: synced,
        lockedCount: countLockedPieces(synced),
        by: props.myId() ?? "local",
        startedAtMs,
      });
      return next;
    });
  }

  function handlePointerDown(
    event: PointerEvent,
    piece: BoardPiece,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
    margin: number,
  ) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    dragMargin = margin;
    const selectionBefore = currentSelection();
    let nextSelection: SelectionState;
    if (event.shiftKey) {
      nextSelection = addPieceRangeSelection(selectionBefore, piece.id);
    } else if (event.ctrlKey || event.metaKey) {
      nextSelection = togglePieceSelection(selectionBefore, piece.id);
    } else if (selectionBefore.pieceIds.has(piece.id)) {
      nextSelection = selectionBefore;
    } else {
      nextSelection = selectOnlyPiece(piece.id);
    }
    setSelection(nextSelection);

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const basePieceIds = nextSelection.pieceIds.size ? nextSelection.pieceIds : new Set([piece.id]);
    const currentLayout = props.layout();
    const activePieceIds = currentLayout && !piece.locked
      ? getConnectedLoosePieceIds(piecesNow, basePieceIds, currentLayout)
      : basePieceIds;
    if (activePieceIds.size > 1) bringSelectionToFront(activePieceIds);
    else {
      const nextZ = bringToFront(piece.id);
      props.broadcast({ type: "piece-front", pieceId: piece.id, z: nextZ, by: props.myId() ?? "local" });
    }

    if (piece.locked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(piecesNow.map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of activePieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    dragging = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startClient: { x: event.clientX, y: event.clientY },
      pieceIds: [...activePieceIds],
      startPointer: pointer,
      startPieces,
      committed: event.pointerType !== "touch",
      lastDeltaX: 0,
      lastDeltaY: 0,
      moveImageOverlay: nextSelection.imageOverlaySelected,
    };
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleImageOverlayPointerDown(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
  ) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selectionBefore = currentSelection();
    let nextSelection: SelectionState;
    if (event.ctrlKey || event.metaKey) {
      nextSelection = toggleImageOverlaySelection(selectionBefore);
    } else {
      nextSelection = selectionBefore.imageOverlaySelected ? selectionBefore : selectOnlyImageOverlay();
    }
    setSelection(nextSelection);
    event.preventDefault();
    event.stopPropagation();

    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(piecesNow.map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of nextSelection.pieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    if (startPieces.size) {
      bringSelectionToFront(nextSelection.pieceIds);
      dragging = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startClient: { x: event.clientX, y: event.clientY },
        pieceIds: [...nextSelection.pieceIds],
        startPointer: pointer,
        startPieces,
        committed: event.pointerType !== "touch",
        lastDeltaX: 0,
        lastDeltaY: 0,
        moveImageOverlay: false,
      };
    }
  }

  function handleDragMove(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
    margin: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    if (!dragging.committed) {
      const clientDistance = Math.hypot(
        event.clientX - dragging.startClient.x,
        event.clientY - dragging.startClient.y,
      );
      if (dragging.pointerType === "touch" && clientDistance < TOUCH_DRAG_THRESHOLD_PX) {
        event.preventDefault();
        return;
      }
      dragging.committed = true;
    }
    dragMargin = margin;
    const deltaX = pointer.x - dragging.startPointer.x;
    const deltaY = pointer.y - dragging.startPointer.y;
    scheduleDragMove({ deltaX, deltaY, onImageOverlayDelta });
    event.preventDefault();
  }

  function scheduleDragMove(move: PendingDragMove) {
    pendingDragMove = move;
    if (dragFrame !== null) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = null;
      flushPendingDragMove();
    });
  }

  function flushPendingDragMove() {
    const move = pendingDragMove;
    pendingDragMove = null;
    if (!move) return;
    applyDragMove(move.deltaX, move.deltaY, move.onImageOverlayDelta);
  }

  function applyDragMove(
    deltaX: number,
    deltaY: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    if (!dragging) return;
    const moves: BatchedPieceMove[] = [];
    for (const id of dragging.pieceIds) {
      const startPiece = dragging.startPieces.get(id);
      if (!startPiece || startPiece.locked) continue;
      const constrained = constrainPosition(id, startPiece.x + deltaX, startPiece.y + deltaY);
      livePieceTransforms.set(id, constrained);
      setPieceDomTransform(id, constrained.x, constrained.y);
      moves.push({ pieceId: id, x: constrained.x, y: constrained.y, z: startPiece.z });
    }
    publishPieceMoves(moves);
    if (dragging.moveImageOverlay && onImageOverlayDelta) {
      onImageOverlayDelta(deltaX - dragging.lastDeltaX, deltaY - dragging.lastDeltaY);
    }
    dragging.lastDeltaX = deltaX;
    dragging.lastDeltaY = deltaY;
  }

  function handleDragEnd(threshold: number, pointerId?: number) {
    if (!dragging) return;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return;
    const ended = dragging;
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    flushPendingDragMove();
    dragging = null;
    if (!ended.committed) {
      livePieceTransforms.clear();
      return;
    }
    const live = new Map(livePieceTransforms);
    livePieceTransforms.clear();
    updatePieces((cur) => {
      const withLive = live.size === 0
        ? cur
        : cur.map((p) => {
            const lp = live.get(p.id);
            return lp && !p.locked ? { ...p, x: lp.x, y: lp.y } : p;
          });

      const movedPieceIds = new Set(ended.pieceIds);
      const currentLayout = props.layout();
      const neighborSnapped = currentLayout
        ? snapLoosePiecesToNeighbors(withLive, movedPieceIds, currentLayout, threshold)
        : withLive;

      const moves: BatchedPieceMove[] = [];
      const locks: BatchedPieceLock[] = [];
      const next = neighborSnapped.map((piece) => {
        if (!ended.startPieces.has(piece.id) || piece.locked) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) {
          locks.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
        } else {
          const previous = withLive.find((candidate) => candidate.id === snapped.id);
          if (previous && (previous.x !== snapped.x || previous.y !== snapped.y)) {
            moves.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
          }
        }
        return snapped;
      });
      publishPieceLocks(locks);
      publishPieceMoves(moves);
      rememberMove(ended.startPieces, next);
      return next;
    });
  }

  function cancelDrag(pointerId?: number): boolean {
    if (!dragging) return false;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return false;
    const canceled = dragging;
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    pendingDragMove = null;
    dragging = null;

    const rollbacks: BatchedPieceMove[] = [];
    for (const [id, startPiece] of canceled.startPieces) {
      livePieceTransforms.delete(id);
      setPieceDomTransform(id, startPiece.x, startPiece.y);
      if (canceled.committed) {
        rollbacks.push({ pieceId: id, x: startPiece.x, y: startPiece.y, z: startPiece.z });
      }
    }
    livePieceTransforms.clear();
    publishPieceMoves(rollbacks);
    return true;
  }

  function handleSelectionBoxPointerDown(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
  ): boolean {
    if (event.button !== 0 || !event.shiftKey) return false;
    if (selectionBoxNow) return false;
    const pointer = getPoint(event);
    if (!pointer) return false;
    selectionBoxNow = { pointerId: event.pointerId, start: pointer, end: pointer };
    setSelectionBox(normalizeRect(pointer, pointer));
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function handleSelectionBoxMove(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
  ): boolean {
    if (!selectionBoxNow) return false;
    if (event.pointerId !== selectionBoxNow.pointerId) return false;
    const pointer = getPoint(event);
    if (!pointer) return true;
    selectionBoxNow.end = pointer;
    setSelectionBox(normalizeRect(selectionBoxNow.start, selectionBoxNow.end));
    event.preventDefault();
    return true;
  }

  function handleSelectionBoxEnd(
    currentLayout: PuzzleLayout,
    imageOverlayRect: Rect | null,
    margin: number,
    pointerId?: number,
  ): boolean {
    if (!selectionBoxNow) return false;
    if (pointerId !== undefined && pointerId !== selectionBoxNow.pointerId) return false;
    const worldRect = normalizeRect(selectionBoxNow.start, selectionBoxNow.end);
    selectionBoxNow = null;
    const rect = { ...worldRect, x: worldRect.x - margin, y: worldRect.y - margin };
    setSelectionBox(null);
    setSelection(selectByRect(piecesNow, currentLayout, rect, imageOverlayRect));
    return true;
  }

  function upsertRemoteSelection(selection: RemoteSelection) {
    setRemoteSelections((cur) => {
      const exists = cur.some((s) => s.participantId === selection.participantId);
      return exists
        ? cur.map((s) => (s.participantId === selection.participantId ? selection : s))
        : [...cur, selection];
    });
  }

  function setStartedAtMsIfUnset(ms: number) {
    if (startedAtMs === null) startedAtMs = ms;
  }

  function markCleared(elapsedMs: number) {
    if (clearedElapsedMsNow !== null) return;
    clearedElapsedMsNow = elapsedMs;
    setClearedElapsedMs(elapsedMs);
  }

  function runSyncCommand(command: SyncCommand) {
    switch (command.kind) {
      case "bumpRemoteVersion":
        remoteMoveVersion += 1;
        break;
      case "notifyMoved":
        props.onPieceMoved?.(command.by);
        break;
      case "notifyLocked":
        props.onPieceLocked?.(command.by);
        break;
      case "transformPieces":
        updatePieces(command.transform);
        break;
      case "applySynced":
        applySyncedPieces(command.pieces);
        break;
      case "setStartedAtMs":
        setStartedAtMsIfUnset(command.startedAtMs);
        break;
      case "upsertRemoteSelection":
        upsertRemoteSelection(command.selection);
        break;
      case "markCleared":
        markCleared(command.elapsedMs);
        break;
    }
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    const commands = reduceMessage(msg, { myId: props.myId(), constrain: constrainPosition });
    for (const command of commands) runSyncCommand(command);
  }

  function removeRemoteSelection(participantId: string) {
    setRemoteSelections((cur) => cur.filter((s) => s.participantId !== participantId));
  }

  const complete = createMemo(() => isComplete(pieces()));
  const lockedCount = createMemo(() => countLockedPieces(pieces()));

  // 完成判定／開始計時 — ホストのみが時刻を確定する
  createEffect(() => {
    const list = pieces();
    const done = complete();
    if (list.length === 0) return;
    if (done) {
      if (!props.isHost()) return;
      if (clearedElapsedMsNow !== null) return;
      if (startedAtMs === null) return;
      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      clearedElapsedMsNow = elapsedMs;
      setClearedElapsedMs(elapsedMs);
      props.broadcast({ type: "puzzle-completed", elapsedMs, by: props.myId() ?? "local" });
      return;
    }
    if (!props.isHost()) return;
    if (startedAtMs !== null) return;
    startedAtMs = Date.now();
    const synced = piecesNow.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    props.broadcast({
      type: "state-sync",
      pieces: synced,
      lockedCount: countLockedPieces(synced),
      by: props.myId() ?? "local",
      startedAtMs,
    });
  });

  return {
    pieces,
    selectedPieceIds,
    imageOverlaySelected,
    selectionBox,
    remoteSelections,
    complete,
    clearedElapsedMs,
    lockedCount,
    getPieces: () => piecesNow,
    getStartedAtMs: () => startedAtMs,
    isDragging: () => dragging !== null,
    constrainPosition,
    bringToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    clearSelection,
    cancelDrag,
    handlePointerDown,
    handleImageOverlayPointerDown,
    handleDragMove,
    handleDragEnd,
    undoLastMove,
    redoLastMove,
    clearMoveHistory,
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    handleMessage,
    removeRemoteSelection,
    registerPieceElement,
  };
}
