import { useRef, useState } from "react";
import { createInitialPieces, isComplete, snapPiece } from "@open-puzzle/shared/puzzle";
import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-puzzle/shared/protocol";
import {
  arrangeLoosePieces,
  countLockedPieces,
  MAX_CANVAS_COORDINATE,
  mergeSyncedPieces,
  updatePieceById,
} from "../utils/puzzle-ops";

type DragState = { id: number; dx: number; dy: number };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
  myId: string | null;
  layout: PuzzleLayout | null;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
};

export function usePuzzle({ broadcast, myId, layout, onPieceMoved, onPieceLocked }: Props) {
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const piecesRef = useRef<BoardPiece[]>([]);
  const pendingSyncRef = useRef<SyncedPiece[] | null>(null);
  const draggingRef = useRef<DragState | null>(null);

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

  function bringToFront(pieceId: number): number {
    const nextZ = Math.max(0, ...piecesRef.current.map((p) => p.z)) + 1;
    updatePieces((cur) => updatePieceById(cur, pieceId, (p) => ({ ...p, z: nextZ })));
    return nextZ;
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
    const nextZ = bringToFront(piece.id);
    if (piece.locked) {
      broadcastRef.current({ type: "piece-front", pieceId: piece.id, z: nextZ, by: myIdRef.current ?? "local" });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer) return;
    broadcastRef.current({ type: "piece-front", pieceId: piece.id, z: nextZ, by: myIdRef.current ?? "local" });
    draggingRef.current = {
      id: piece.id,
      dx: pointer.x - (margin + piece.x),
      dy: pointer.y - (margin + piece.y),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragMove(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => { x: number; y: number } | null,
    margin: number,
  ) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    const { x, y } = constrainPosition(
      dragging.id,
      pointer.x - dragging.dx - margin,
      pointer.y - dragging.dy - margin,
    );
    updatePieces((cur) =>
      updatePieceById(cur, dragging.id, (piece) => {
        if (piece.locked) return piece;
        const next = { ...piece, x, y };
        broadcastRef.current({ type: "piece-move", pieceId: piece.id, x: next.x, y: next.y, z: next.z, by: myIdRef.current ?? "local" });
        return next;
      }),
    );
  }

  function handleDragEnd(threshold: number) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    draggingRef.current = null;
    updatePieces((cur) =>
      updatePieceById(cur, dragging.id, (piece) => {
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) {
          broadcastRef.current({ type: "piece-lock", pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z, by: myIdRef.current ?? "local" });
        }
        return snapped;
      }),
    );
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
      case "state-sync":
        applySyncedPieces(msg.pieces);
        break;
    }
  }

  const complete = isComplete(pieces);
  const lockedCount = countLockedPieces(pieces);

  return {
    pieces,
    piecesRef,
    pendingSyncRef,
    draggingRef,
    complete,
    lockedCount,
    constrainPosition,
    bringToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    handlePointerDown,
    handleDragMove,
    handleDragEnd,
    handleMessage,
  };
}
