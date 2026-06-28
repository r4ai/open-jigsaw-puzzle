import { createSignal, onCleanup } from "solid-js";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import {
  createEmptySelection,
  normalizeRect,
  selectByRect,
  type Rect,
  type SelectionState,
} from "../../utils/puzzle-ops";
import type { RemoteSelection, SelectionBoxState } from "./types";

type Deps = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  /** Synchronous piece mirror; used to hit-test the rubber-band rectangle. */
  getPieces: () => BoardPiece[];
};

/**
 * Owns the local selection (pieces + image overlay), the rubber-band selection
 * box, and the rate-limited broadcast of selection presence to peers, plus the
 * mirror of every peer's selection for presence rendering.
 */
export function useSelection(deps: Deps) {
  const [selectedPieceIds, setSelectedPieceIds] = createSignal<Set<number>>(new Set());
  const [imageOverlaySelected, setImageOverlaySelected] = createSignal(false);
  const [selectionBox, setSelectionBox] = createSignal<Rect | null>(null);
  const [remoteSelections, setRemoteSelections] = createSignal<RemoteSelection[]>([]);

  let selectedPieceIdsNow = new Set<number>();
  let imageOverlaySelectedNow = false;
  let lastSelectedPieceId: number | null = null;
  let selectionBoxNow: SelectionBoxState | null = null;
  let pendingSelectionPresence: { pieceIds: Set<number>; imageOverlaySelected: boolean } | null = null;
  let selectionPresenceFrame: number | null = null;

  onCleanup(() => {
    if (selectionPresenceFrame !== null) cancelAnimationFrame(selectionPresenceFrame);
  });

  function publishSelectionNow(pieceIds: Set<number>, imageSelected: boolean) {
    const participantId = deps.myId();
    if (!participantId) return;
    deps.broadcast({
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

  function setSelection(next: SelectionState) {
    selectedPieceIdsNow = next.pieceIds;
    imageOverlaySelectedNow = next.imageOverlaySelected;
    lastSelectedPieceId = next.lastSelectedPieceId;
    setSelectedPieceIds(next.pieceIds);
    setImageOverlaySelected(next.imageOverlaySelected);
    publishSelection(next.pieceIds, next.imageOverlaySelected);
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
    setSelection(selectByRect(deps.getPieces(), currentLayout, rect, imageOverlayRect));
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

  function removeRemoteSelection(participantId: string) {
    setRemoteSelections((cur) => cur.filter((s) => s.participantId !== participantId));
  }

  return {
    selectedPieceIds,
    imageOverlaySelected,
    selectionBox,
    remoteSelections,
    setSelection,
    clearSelection,
    currentSelection,
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    upsertRemoteSelection,
    removeRemoteSelection,
  };
}
