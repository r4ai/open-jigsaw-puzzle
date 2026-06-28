import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";

/** An in-flight pointer drag of one or more pieces (and optionally the image overlay). */
export type DragState = {
  pointerId: number;
  pointerType: string;
  startClient: { x: number; y: number };
  pieceIds: number[];
  startPointer: { x: number; y: number };
  startPieces: Map<number, BoardPiece>;
  committed: boolean;
  lastDeltaX: number;
  lastDeltaY: number;
  moveImageOverlay: boolean;
};

/** A drag delta queued for the next animation frame. */
export type PendingDragMove = {
  deltaX: number;
  deltaY: number;
  onImageOverlayDelta?: (deltaX: number, deltaY: number) => void;
};

/** An in-flight shift-drag rectangle selection, in world coordinates. */
export type SelectionBoxState = {
  pointerId: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** Another participant's current selection, mirrored locally for presence rendering. */
export type RemoteSelection = {
  participantId: string;
  pieceIds: number[];
  imageOverlaySelected: boolean;
};

export type BatchedPieceMove = Extract<ChannelMessage, { type: "piece-moves" }>["moves"][number];
export type BatchedPieceLock = Extract<ChannelMessage, { type: "piece-locks" }>["locks"][number];
