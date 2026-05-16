import { Maximize2, Minus, MousePointer2, Plus } from "lucide-react";
import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { RemoteCursor } from "../hooks/useRemoteCursors";
import type { PanOffset } from "../hooks/useViewport";
import { ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from "../hooks/useViewport";
import { JigsawPiece } from "./JigsawPiece";
import { participantColor } from "../utils/participant";

type Props = {
  layout: PuzzleLayout;
  imageDataUrl: string;
  pieces: BoardPiece[];
  zoom: number;
  pan: PanOffset;
  panning: boolean;
  margin: number;
  complete: boolean;
  loadingSummary: string;
  remoteCursors: RemoteCursor[];
  activeRemoteCursorIds: Set<string>;
  myId: string | null;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  worldRef: React.RefObject<HTMLDivElement | null>;
  imageOverlayPosition: { x: number; y: number } | null;
  onImageOverlayPointerDown: (e: React.PointerEvent) => void;
  onPiecePointerDown: (e: React.PointerEvent, piece: BoardPiece) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onViewportPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

export function PuzzleBoard({
  layout,
  imageDataUrl,
  pieces,
  zoom,
  pan,
  panning,
  margin,
  complete,
  loadingSummary,
  remoteCursors,
  activeRemoteCursorIds,
  viewportRef,
  worldRef,
  imageOverlayPosition,
  onImageOverlayPointerDown,
  onPiecePointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onViewportPointerDown,
  onWheel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: Props) {
  return (
    <>
      <div
        ref={viewportRef}
        className={`board-viewport ${panning ? "panning" : ""}`}
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
      >
        <div className="board-stage">
          <div
            ref={worldRef}
            className="board-world"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <div
              className={`puzzle-frame ${complete ? "complete" : ""}`}
              style={{
                left: `${margin}px`,
                top: `${margin}px`,
                width: `${layout.boardWidth}px`,
                height: `${layout.boardHeight}px`,
              }}
            />
            {imageOverlayPosition && (
              <div
                className="image-overlay"
                style={{
                  left: `${margin + imageOverlayPosition.x}px`,
                  top: `${margin + imageOverlayPosition.y}px`,
                  width: `${layout.boardWidth}px`,
                  height: `${layout.boardHeight}px`,
                }}
                onPointerDown={onImageOverlayPointerDown}
              >
                <img
                  src={imageDataUrl}
                  alt="元の画像"
                  className="image-overlay-img"
                  draggable={false}
                />
              </div>
            )}
            {pieces.map((piece) => {
              const geometry = layout.pieces[piece.id];
              return (
                <button
                  key={piece.id}
                  className={`piece ${piece.locked ? "locked" : ""}`}
                  style={{
                    left: `${margin + piece.x}px`,
                    top: `${margin + piece.y}px`,
                    width: `${layout.pieceWidth}px`,
                    height: `${layout.pieceHeight}px`,
                    zIndex: piece.z,
                  }}
                  aria-label={`piece ${piece.id + 1}`}
                  onPointerDown={(e) => onPiecePointerDown(e, piece)}
                >
                  <JigsawPiece
                    geometry={geometry}
                    imageDataUrl={imageDataUrl}
                    layout={layout}
                    pieceId={piece.id}
                  />
                </button>
              );
            })}
            {remoteCursors.map((cursor) => (
              <div
                key={cursor.participantId}
                className={`remote-cursor${activeRemoteCursorIds.has(cursor.participantId) ? " dragging" : ""}`}
                style={{
                  "--cursor-x": `${cursor.x}px`,
                  "--cursor-y": `${cursor.y}px`,
                  "--cursor-color": participantColor(cursor.participantId),
                } as React.CSSProperties & Record<"--cursor-x" | "--cursor-y" | "--cursor-color", string>}
                title={cursor.name}
              >
                <MousePointer2 size={16} />
                <span>{cursor.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="zoom-controls">
        <button onClick={onZoomOut} disabled={zoom <= MIN_ZOOM} title="縮小">
          <Minus size={13} />
        </button>
        <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn} disabled={zoom >= MAX_ZOOM} title="拡大">
          <Plus size={13} />
        </button>
        <button onClick={onResetZoom} title="表示をリセット">
          <Maximize2 size={13} />
        </button>
      </div>

      <div className={`canvas-status ${complete ? "complete" : ""}`}>
        {complete ? "完成 ✓" : loadingSummary}
      </div>
    </>
  );
}

export { ZOOM_STEP };
