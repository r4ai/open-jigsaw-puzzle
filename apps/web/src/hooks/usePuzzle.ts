import { useEffect, useRef, useState } from "react";
import { createInitialPieces, isComplete, snapPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-jigsaw-puzzle/shared/protocol";
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

type DragState = {
  pointerId: number;
  pieceIds: number[];
  startPointer: { x: number; y: number };
  startPieces: Map<number, BoardPiece>;
  lastDeltaX: number;
  lastDeltaY: number;
  moveImageOverlay: boolean;
};
type PendingDragMove = {
  deltaX: number;
  deltaY: number;
  onImageOverlayDelta?: (deltaX: number, deltaY: number) => void;
};
type SelectionBoxState = { pointerId: number; start: { x: number; y: number }; end: { x: number; y: number } };
export type RemoteSelection = { participantId: string; pieceIds: number[]; imageOverlaySelected: boolean };
type BatchedPieceMove = Extract<ChannelMessage, { type: "piece-moves" }>["moves"][number];
type BatchedPieceLock = Extract<ChannelMessage, { type: "piece-locks" }>["locks"][number];

type Props = {
  broadcast: (msg: ChannelMessage) => void;
  myId: string | null;
  isHost: boolean;
  layout: PuzzleLayout | null;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
};

export function usePuzzle({ broadcast, myId, isHost, layout, onPieceMoved, onPieceLocked }: Props) {
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<number>>(new Set());
  const [imageOverlaySelected, setImageOverlaySelected] = useState(false);
  const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([]);
  const [clearedElapsedMs, setClearedElapsedMs] = useState<number | null>(null);
  const startedAtMsRef = useRef<number | null>(null);
  const clearedElapsedMsRef = useRef<number | null>(null);
  const piecesRef = useRef<BoardPiece[]>([]);
  const pendingSyncRef = useRef<SyncedPiece[] | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const pendingDragMoveRef = useRef<PendingDragMove | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingSelectionPresenceRef = useRef<{ pieceIds: Set<number>; imageOverlaySelected: boolean } | null>(null);
  const selectionPresenceFrameRef = useRef<number | null>(null);
  const selectedPieceIdsRef = useRef<Set<number>>(new Set());
  const imageOverlaySelectedRef = useRef(false);
  const lastSelectedPieceIdRef = useRef<number | null>(null);
  const selectionBoxRef = useRef<SelectionBoxState | null>(null);
  const historyRef = useRef(createPieceHistory());
  const remoteMoveVersionRef = useRef(0);

  // Keep refs in sync (ref pattern for WS callbacks)
  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onPieceMovedRef = useRef(onPieceMoved);
  onPieceMovedRef.current = onPieceMoved;
  const onPieceLockedRef = useRef(onPieceLocked);
  onPieceLockedRef.current = onPieceLocked;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      if (selectionPresenceFrameRef.current !== null) cancelAnimationFrame(selectionPresenceFrameRef.current);
    };
  }, []);

  function constrainPosition(pieceId: number, x: number, y: number): { x: number; y: number } {
    if (
      !Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > MAX_CANVAS_COORDINATE || Math.abs(y) > MAX_CANVAS_COORDINATE
    ) {
      const fallback = piecesRef.current[pieceId];
      return { x: fallback?.x ?? 0, y: fallback?.y ?? 0 };
    }
    return { x, y };
  }

  function updatePieces(updater: (cur: BoardPiece[]) => BoardPiece[]) {
    setPieces((cur) => {
      const next = updater(cur);
      piecesRef.current = next;
      return next;
    });
  }

  function publishSelectionNow(pieceIds: Set<number>, imageSelected: boolean) {
    const participantId = myIdRef.current;
    if (!participantId) return;
    broadcastRef.current({
      type: "selection-presence",
      participantId,
      pieceIds: [...pieceIds].sort((a, b) => a - b),
      imageOverlaySelected: imageSelected,
    });
  }

  function publishSelection(pieceIds = selectedPieceIdsRef.current, imageSelected = imageOverlaySelectedRef.current) {
    pendingSelectionPresenceRef.current = { pieceIds, imageOverlaySelected: imageSelected };
    if (selectionPresenceFrameRef.current !== null) return;
    selectionPresenceFrameRef.current = requestAnimationFrame(() => {
      selectionPresenceFrameRef.current = null;
      const pending = pendingSelectionPresenceRef.current;
      pendingSelectionPresenceRef.current = null;
      if (!pending) return;
      publishSelectionNow(pending.pieceIds, pending.imageOverlaySelected);
    });
  }

  function publishPieceMoves(moves: BatchedPieceMove[]) {
    const by = myIdRef.current ?? "local";
    if (moves.length === 0) return;
    if (moves.length === 1) {
      const move = moves[0]!;
      broadcastRef.current({ type: "piece-move", ...move, by });
      return;
    }
    broadcastRef.current({ type: "piece-moves", moves, by });
  }

  function publishPieceLocks(locks: BatchedPieceLock[]) {
    const by = myIdRef.current ?? "local";
    if (locks.length === 0) return;
    if (locks.length === 1) {
      const lock = locks[0]!;
      broadcastRef.current({ type: "piece-lock", ...lock, by });
      return;
    }
    broadcastRef.current({ type: "piece-locks", locks, by });
  }

  function setSelection(next: SelectionState) {
    selectedPieceIdsRef.current = next.pieceIds;
    imageOverlaySelectedRef.current = next.imageOverlaySelected;
    lastSelectedPieceIdRef.current = next.lastSelectedPieceId;
    setSelectedPieceIds(next.pieceIds);
    setImageOverlaySelected(next.imageOverlaySelected);
    publishSelection(next.pieceIds, next.imageOverlaySelected);
  }

  function rememberMove(startPieces: Map<number, BoardPiece>, nextPieces: BoardPiece[]) {
    historyRef.current.remember(createMoveHistoryEntry(startPieces.values(), nextPieces, remoteMoveVersionRef.current));
  }

  function applyHistorySnapshots(snapshots: PieceHistorySnapshot[]) {
    updatePieces((cur) => {
      const next = applyPieceSnapshots(cur, snapshots);
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      broadcastRef.current({ type: "state-sync", pieces: synced, lockedCount: countLockedPieces(synced), by: myIdRef.current ?? "local", startedAtMs: startedAtMsRef.current });
      return next;
    });
  }

  function undoLastMove(): HistoryResult {
    const { result, snapshots } = historyRef.current.undo(remoteMoveVersionRef.current);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function redoLastMove(): HistoryResult {
    const { result, snapshots } = historyRef.current.redo(remoteMoveVersionRef.current);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function clearMoveHistory(resetRemoteVersion = false) {
    historyRef.current.clear();
    if (resetRemoteVersion) remoteMoveVersionRef.current = 0;
  }

  function clearSelection() {
    setSelection(createEmptySelection());
  }

  function currentSelection(): SelectionState {
    return {
      pieceIds: selectedPieceIdsRef.current,
      imageOverlaySelected: imageOverlaySelectedRef.current,
      lastSelectedPieceId: lastSelectedPieceIdRef.current,
    };
  }

  function bringToFront(pieceId: number): number {
    const nextZ = Math.max(0, ...piecesRef.current.map((p) => p.z)) + 1;
    updatePieces((cur) => updatePieceById(cur, pieceId, (p) => ({ ...p, z: nextZ })));
    return nextZ;
  }

  function bringSelectionToFront(pieceIds: Set<number>) {
    const before = piecesRef.current;
    const next = bringSelectedPiecesToFront(before, pieceIds);
    if (next === before) return;
    piecesRef.current = next;
    setPieces(next);
    const beforeById = new Map(before.map((piece) => [piece.id, piece]));
    for (const piece of next) {
      const previous = beforeById.get(piece.id);
      if (previous && previous.z !== piece.z) {
        broadcastRef.current({ type: "piece-front", pieceId: piece.id, z: piece.z, by: myIdRef.current ?? "local" });
      }
    }
  }

  function resetTimer() {
    startedAtMsRef.current = null;
    clearedElapsedMsRef.current = null;
    setClearedElapsedMs(null);
  }

  function setNewPieces(newLayout: PuzzleLayout) {
    const nextPieces = createInitialPieces(newLayout);
    piecesRef.current = nextPieces;
    pendingSyncRef.current = null;
    clearMoveHistory(true);
    resetTimer();
    setPieces(nextPieces);
  }

  function receiveImage(nextLayout: PuzzleLayout) {
    setPieces((cur) => {
      const base = createInitialPieces(nextLayout);
      const pending = pendingSyncRef.current;
      pendingSyncRef.current = null;
      clearMoveHistory(true);
      resetTimer();
      if (!pending) {
        piecesRef.current = base;
        return base;
      }
      const constrained = pending.map((p) => {
        const { x, y } = constrainPosition(p.id, p.x, p.y);
        return { ...p, x, y };
      });
      const next = mergeSyncedPieces(base, constrained);
      piecesRef.current = next;
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
        pendingSyncRef.current = constrained;
        return cur;
      }
      pendingSyncRef.current = null;
      const next = mergeSyncedPieces(cur, constrained);
      piecesRef.current = next;
      return next;
    });
  }

  function organizePieces(currentLayout: PuzzleLayout) {
    setPieces((cur) => {
      clearMoveHistory();
      const next = arrangeLoosePieces(cur, currentLayout);
      piecesRef.current = next;
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      broadcastRef.current({ type: "state-sync", pieces: synced, lockedCount: countLockedPieces(synced), by: myIdRef.current ?? "local", startedAtMs: startedAtMsRef.current });
      return next;
    });
  }

  function handlePointerDown(
    event: React.PointerEvent,
    piece: BoardPiece,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
    margin: number,
  ) {
    if (event.button !== 0) return;
    if (draggingRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
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
    const activePieceIds = layoutRef.current && !piece.locked
      ? getConnectedLoosePieceIds(piecesRef.current, basePieceIds, layoutRef.current)
      : basePieceIds;
    if (activePieceIds.size > 1) bringSelectionToFront(activePieceIds);
    else {
      const nextZ = bringToFront(piece.id);
      broadcastRef.current({ type: "piece-front", pieceId: piece.id, z: nextZ, by: myIdRef.current ?? "local" });
    }

    if (piece.locked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(piecesRef.current.map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of activePieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    draggingRef.current = {
      pointerId: event.pointerId,
      pieceIds: [...activePieceIds],
      startPointer: pointer,
      startPieces,
      lastDeltaX: 0,
      lastDeltaY: 0,
      moveImageOverlay: nextSelection.imageOverlaySelected,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleImageOverlayPointerDown(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
  ) {
    if (event.button !== 0) return;
    if (draggingRef.current) {
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
    const pieceById = new Map(piecesRef.current.map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of nextSelection.pieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    if (startPieces.size) {
      bringSelectionToFront(nextSelection.pieceIds);
      draggingRef.current = {
        pointerId: event.pointerId,
        pieceIds: [...nextSelection.pieceIds],
        startPointer: pointer,
        startPieces,
        lastDeltaX: 0,
        lastDeltaY: 0,
        moveImageOverlay: false,
      };
    }
  }

  function handleDragMove(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
    margin: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    const deltaX = pointer.x - dragging.startPointer.x;
    const deltaY = pointer.y - dragging.startPointer.y;
    scheduleDragMove({ deltaX, deltaY, onImageOverlayDelta });
    event.preventDefault();
  }

  function scheduleDragMove(move: PendingDragMove) {
    pendingDragMoveRef.current = move;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      flushPendingDragMove();
    });
  }

  function flushPendingDragMove() {
    const move = pendingDragMoveRef.current;
    pendingDragMoveRef.current = null;
    if (!move) return;
    applyDragMove(move.deltaX, move.deltaY, move.onImageOverlayDelta);
  }

  function applyDragMove(
    deltaX: number,
    deltaY: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    updatePieces((cur) => {
      const moves: BatchedPieceMove[] = [];
      const nextPieces = cur.map((piece) => {
        if (!dragging.startPieces.has(piece.id) || piece.locked) return piece;
        const startPiece = dragging.startPieces.get(piece.id)!;
        const constrained = constrainPosition(piece.id, startPiece.x + deltaX, startPiece.y + deltaY);
        const next = { ...piece, x: constrained.x, y: constrained.y };
        moves.push({ pieceId: piece.id, x: next.x, y: next.y, z: next.z });
        return next;
      });
      publishPieceMoves(moves);
      return nextPieces;
    });
    if (dragging.moveImageOverlay && onImageOverlayDelta) {
      onImageOverlayDelta(deltaX - dragging.lastDeltaX, deltaY - dragging.lastDeltaY);
    }
    dragging.lastDeltaX = deltaX;
    dragging.lastDeltaY = deltaY;
  }

  function handleDragEnd(threshold: number, pointerId?: number) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return;
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    flushPendingDragMove();
    draggingRef.current = null;
    updatePieces((cur) => {
      const movedPieceIds = new Set(dragging.pieceIds);
      const neighborSnapped = layoutRef.current
        ? snapLoosePiecesToNeighbors(cur, movedPieceIds, layoutRef.current, threshold)
        : cur;

      const moves: BatchedPieceMove[] = [];
      const locks: BatchedPieceLock[] = [];
      const next = neighborSnapped.map((piece) => {
        if (!dragging.startPieces.has(piece.id) || piece.locked) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) {
          locks.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
        } else {
          const previous = cur.find((candidate) => candidate.id === snapped.id);
          if (previous && (previous.x !== snapped.x || previous.y !== snapped.y)) {
            moves.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
          }
        }
        return snapped;
      });
      publishPieceLocks(locks);
      publishPieceMoves(moves);
      rememberMove(dragging.startPieces, next);
      return next;
    });
  }

  function handleSelectionBoxPointerDown(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
  ): boolean {
    if (event.button !== 0 || !event.shiftKey) return false;
    if (selectionBoxRef.current) return false;
    const pointer = getPoint(event);
    if (!pointer) return false;
    selectionBoxRef.current = { pointerId: event.pointerId, start: pointer, end: pointer };
    setSelectionBox(normalizeRect(pointer, pointer));
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function handleSelectionBoxMove(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
  ): boolean {
    const box = selectionBoxRef.current;
    if (!box) return false;
    if (event.pointerId !== box.pointerId) return false;
    const pointer = getPoint(event);
    if (!pointer) return true;
    box.end = pointer;
    setSelectionBox(normalizeRect(box.start, box.end));
    event.preventDefault();
    return true;
  }

  function handleSelectionBoxEnd(
    currentLayout: PuzzleLayout,
    imageOverlayRect: Rect | null,
    margin: number,
    pointerId?: number,
  ): boolean {
    const box = selectionBoxRef.current;
    if (!box) return false;
    if (pointerId !== undefined && pointerId !== box.pointerId) return false;
    selectionBoxRef.current = null;
    const worldRect = normalizeRect(box.start, box.end);
    const rect = { ...worldRect, x: worldRect.x - margin, y: worldRect.y - margin };
    setSelectionBox(null);
    setSelection(selectByRect(piecesRef.current, currentLayout, rect, imageOverlayRect));
    return true;
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    switch (msg.type) {
      case "piece-move":
        if (msg.by !== myIdRef.current) remoteMoveVersionRef.current += 1;
        onPieceMovedRef.current?.(msg.by);
        updatePieces((cur) =>
          updatePieceById(cur, msg.pieceId, (piece) => {
            if (piece.locked) return piece;
            const { x, y } = constrainPosition(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z };
          }),
        );
        break;
      case "piece-moves":
        if (msg.by !== myIdRef.current) remoteMoveVersionRef.current += 1;
        onPieceMovedRef.current?.(msg.by);
        updatePieces((cur) => {
          const movesById = new Map(msg.moves.map((move) => [move.pieceId, move]));
          return cur.map((piece) => {
            const move = movesById.get(piece.id);
            if (!move || piece.locked) return piece;
            const { x, y } = constrainPosition(move.pieceId, move.x, move.y);
            return { ...piece, x, y, z: move.z };
          });
        });
        break;
      case "piece-lock":
        if (msg.by !== myIdRef.current) remoteMoveVersionRef.current += 1;
        onPieceLockedRef.current?.(msg.by);
        updatePieces((cur) =>
          updatePieceById(cur, msg.pieceId, (piece) => {
            const { x, y } = constrainPosition(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z, locked: true };
          }),
        );
        break;
      case "piece-locks":
        if (msg.by !== myIdRef.current) remoteMoveVersionRef.current += 1;
        onPieceLockedRef.current?.(msg.by);
        updatePieces((cur) => {
          const locksById = new Map(msg.locks.map((lock) => [lock.pieceId, lock]));
          return cur.map((piece) => {
            const lock = locksById.get(piece.id);
            if (!lock) return piece;
            const { x, y } = constrainPosition(lock.pieceId, lock.x, lock.y);
            return { ...piece, x, y, z: lock.z, locked: true };
          });
        });
        break;
      case "piece-front":
        updatePieces((cur) =>
          updatePieceById(cur, msg.pieceId, (piece) => ({ ...piece, z: msg.z })),
        );
        break;
      case "selection-presence":
        setRemoteSelections((cur) => {
          const next: RemoteSelection = {
            participantId: msg.participantId,
            pieceIds: msg.pieceIds,
            imageOverlaySelected: msg.imageOverlaySelected,
          };
          const exists = cur.some((selection) => selection.participantId === msg.participantId);
          return exists
            ? cur.map((selection) => (selection.participantId === msg.participantId ? next : selection))
            : [...cur, next];
        });
        break;
      case "state-sync":
        if (!msg.by || msg.by !== myIdRef.current) remoteMoveVersionRef.current += 1;
        if (msg.startedAtMs != null && startedAtMsRef.current === null) {
          startedAtMsRef.current = msg.startedAtMs;
        }
        applySyncedPieces(msg.pieces);
        break;
      case "puzzle-completed":
        if (clearedElapsedMsRef.current === null) {
          clearedElapsedMsRef.current = msg.elapsedMs;
          setClearedElapsedMs(msg.elapsedMs);
        }
        break;
    }
  }

  function removeRemoteSelection(participantId: string) {
    setRemoteSelections((cur) => cur.filter((selection) => selection.participantId !== participantId));
  }

  const complete = isComplete(pieces);
  const lockedCount = countLockedPieces(pieces);

  useEffect(() => {
    if (pieces.length === 0) return;
    if (complete) {
      if (!isHostRef.current) return;
      if (clearedElapsedMsRef.current !== null) return;
      if (startedAtMsRef.current === null) return;
      const elapsedMs = Math.max(0, Date.now() - startedAtMsRef.current);
      clearedElapsedMsRef.current = elapsedMs;
      setClearedElapsedMs(elapsedMs);
      broadcastRef.current({ type: "puzzle-completed", elapsedMs, by: myIdRef.current ?? "local" });
      return;
    }
    if (!isHostRef.current) return;
    if (startedAtMsRef.current !== null) return;
    startedAtMsRef.current = Date.now();
    const synced = piecesRef.current.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    broadcastRef.current({
      type: "state-sync",
      pieces: synced,
      lockedCount: countLockedPieces(synced),
      by: myIdRef.current ?? "local",
      startedAtMs: startedAtMsRef.current,
    });
  }, [pieces, complete]);

  return {
    pieces,
    piecesRef,
    pendingSyncRef,
    startedAtMsRef,
    draggingRef,
    selectedPieceIds,
    imageOverlaySelected,
    selectionBox,
    remoteSelections,
    complete,
    clearedElapsedMs,
    lockedCount,
    constrainPosition,
    bringToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    clearSelection,
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
  };
}
