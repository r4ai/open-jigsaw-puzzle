import { useRef, useState } from "react";
import { createInitialPieces, isComplete, snapPiece } from "@open-puzzle/shared/puzzle";
import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-puzzle/shared/protocol";
import {
  arrangeLoosePieces,
  bringSelectedPiecesToFront,
  countLockedPieces,
  createEmptySelection,
  MAX_CANVAS_COORDINATE,
  mergeSyncedPieces,
  normalizeRect,
  selectByRect,
  selectOnlyImageOverlay,
  selectOnlyPiece,
  toggleImageOverlaySelection,
  togglePieceSelection,
  addPieceRangeSelection,
  updatePieceById,
} from "../utils/puzzle-ops";
import type { Rect, SelectionState } from "../utils/puzzle-ops";

type DragState = {
  pieceIds: number[];
  startPointer: { x: number; y: number };
  startPieces: Map<number, BoardPiece>;
  lastDeltaX: number;
  lastDeltaY: number;
  moveImageOverlay: boolean;
};
type SelectionBoxState = { start: { x: number; y: number }; end: { x: number; y: number } };
export type RemoteSelection = { participantId: string; pieceIds: number[]; imageOverlaySelected: boolean };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
  myId: string | null;
  layout: PuzzleLayout | null;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
};

export function usePuzzle({ broadcast, myId, layout, onPieceMoved, onPieceLocked }: Props) {
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<number>>(new Set());
  const [imageOverlaySelected, setImageOverlaySelected] = useState(false);
  const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([]);
  const piecesRef = useRef<BoardPiece[]>([]);
  const pendingSyncRef = useRef<SyncedPiece[] | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const selectedPieceIdsRef = useRef<Set<number>>(new Set());
  const imageOverlaySelectedRef = useRef(false);
  const lastSelectedPieceIdRef = useRef<number | null>(null);
  const selectionBoxRef = useRef<SelectionBoxState | null>(null);

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

  function publishSelection(pieceIds = selectedPieceIdsRef.current, imageSelected = imageOverlaySelectedRef.current) {
    const participantId = myIdRef.current;
    if (!participantId) return;
    broadcastRef.current({
      type: "selection-presence",
      participantId,
      pieceIds: [...pieceIds].sort((a, b) => a - b),
      imageOverlaySelected: imageSelected,
    });
  }

  function setSelection(next: SelectionState) {
    selectedPieceIdsRef.current = next.pieceIds;
    imageOverlaySelectedRef.current = next.imageOverlaySelected;
    lastSelectedPieceIdRef.current = next.lastSelectedPieceId;
    setSelectedPieceIds(next.pieceIds);
    setImageOverlaySelected(next.imageOverlaySelected);
    publishSelection(next.pieceIds, next.imageOverlaySelected);
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
    for (const piece of next) {
      const previous = before.find((p) => p.id === piece.id);
      if (previous && previous.z !== piece.z) {
        broadcastRef.current({ type: "piece-front", pieceId: piece.id, z: piece.z, by: myIdRef.current ?? "local" });
      }
    }
  }

  function setNewPieces(newLayout: PuzzleLayout) {
    const nextPieces = createInitialPieces(newLayout);
    piecesRef.current = nextPieces;
    pendingSyncRef.current = null;
    setPieces(nextPieces);
  }

  function receiveImage(nextLayout: PuzzleLayout) {
    setPieces((cur) => {
      const base = cur.length ? cur : createInitialPieces(nextLayout);
      const pending = pendingSyncRef.current;
      pendingSyncRef.current = null;
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
      const next = arrangeLoosePieces(cur, currentLayout);
      piecesRef.current = next;
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      broadcastRef.current({ type: "state-sync", pieces: synced, lockedCount: countLockedPieces(synced) });
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

    const activePieceIds = nextSelection.pieceIds.size ? nextSelection.pieceIds : new Set([piece.id]);
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
    for (const id of activePieceIds) {
      const selectedPiece = piecesRef.current.find((p) => p.id === id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    draggingRef.current = {
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
    for (const id of nextSelection.pieceIds) {
      const selectedPiece = piecesRef.current.find((p) => p.id === id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    if (startPieces.size) {
      bringSelectionToFront(nextSelection.pieceIds);
      draggingRef.current = {
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
    const pointer = getPoint(event);
    if (!pointer) return;
    const deltaX = pointer.x - dragging.startPointer.x;
    const deltaY = pointer.y - dragging.startPointer.y;
    updatePieces((cur) => cur.map((piece) => {
      if (!dragging.startPieces.has(piece.id) || piece.locked) return piece;
      const startPiece = dragging.startPieces.get(piece.id)!;
      const constrained = constrainPosition(piece.id, startPiece.x + deltaX, startPiece.y + deltaY);
      const next = { ...piece, x: constrained.x, y: constrained.y };
      broadcastRef.current({ type: "piece-move", pieceId: piece.id, x: next.x, y: next.y, z: next.z, by: myIdRef.current ?? "local" });
      return next;
    }));
    if (dragging.moveImageOverlay && onImageOverlayDelta) {
      onImageOverlayDelta(deltaX - dragging.lastDeltaX, deltaY - dragging.lastDeltaY);
    }
    dragging.lastDeltaX = deltaX;
    dragging.lastDeltaY = deltaY;
  }

  function handleDragEnd(threshold: number) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    draggingRef.current = null;
    updatePieces((cur) =>
      cur.map((piece) => {
        if (!dragging.startPieces.has(piece.id) || piece.locked) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) {
          broadcastRef.current({ type: "piece-lock", pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z, by: myIdRef.current ?? "local" });
        }
        return snapped;
      }),
    );
  }

  function handleSelectionBoxPointerDown(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
  ): boolean {
    if (event.button !== 0 || !event.shiftKey) return false;
    const pointer = getPoint(event);
    if (!pointer) return false;
    selectionBoxRef.current = { start: pointer, end: pointer };
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
  ): boolean {
    const box = selectionBoxRef.current;
    if (!box) return false;
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
        onPieceMovedRef.current?.(msg.by);
        updatePieces((cur) =>
          updatePieceById(cur, msg.pieceId, (piece) => {
            if (piece.locked) return piece;
            const { x, y } = constrainPosition(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z };
          }),
        );
        break;
      case "piece-lock":
        onPieceLockedRef.current?.(msg.by);
        updatePieces((cur) =>
          updatePieceById(cur, msg.pieceId, (piece) => {
            const { x, y } = constrainPosition(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z, locked: true };
          }),
        );
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
        applySyncedPieces(msg.pieces);
        break;
    }
  }

  function removeRemoteSelection(participantId: string) {
    setRemoteSelections((cur) => cur.filter((selection) => selection.participantId !== participantId));
  }

  const complete = isComplete(pieces);
  const lockedCount = countLockedPieces(pieces);

  return {
    pieces,
    piecesRef,
    pendingSyncRef,
    draggingRef,
    selectedPieceIds,
    imageOverlaySelected,
    selectionBox,
    remoteSelections,
    complete,
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
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    handleMessage,
    removeRemoteSelection,
  };
}
