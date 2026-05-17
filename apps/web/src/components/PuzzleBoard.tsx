import { useRef } from "react";
import { Lock, LockOpen, Maximize2, Minus, MousePointer2, Plus } from "lucide-react";
import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { RemoteSelection } from "../hooks/usePuzzle";
import type { RemoteCursor } from "../hooks/useRemoteCursors";
import type { PanOffset } from "../hooks/useViewport";
import { ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from "../hooks/useViewport";
import { JigsawPiece } from "./JigsawPiece";
import { participantColor } from "../utils/participant";
import styles from "./PuzzleBoard.module.css";

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
  selectedPieceIds: Set<number>;
  imageOverlaySelected: boolean;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  remoteSelections: RemoteSelection[];
  myId: string | null;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  worldRef: React.RefObject<HTMLDivElement | null>;
  imageOverlayPosition: { x: number; y: number } | null;
  imageOverlayLocked: boolean;
  imageOverlayOpacity: number;
  onToggleImageLock: () => void;
  onChangeImageOpacity: (value: number) => void;
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
  selectedPieceIds,
  imageOverlaySelected,
  imageOverlayLocked,
  imageOverlayOpacity,
  selectionBox,
  remoteSelections,
  myId,
  viewportRef,
  worldRef,
  imageOverlayPosition,
  onToggleImageLock,
  onChangeImageOpacity,
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const myColor = myId ? participantColor(myId) : null;
  const remotePieceColors = new Map<number, string>();
  let remoteImageOverlayColor: string | null = null;
  for (const selection of remoteSelections) {
    const color = participantColor(selection.participantId);
    for (const pieceId of selection.pieceIds) {
      if (!remotePieceColors.has(pieceId)) remotePieceColors.set(pieceId, color);
    }
    if (selection.imageOverlaySelected && !remoteImageOverlayColor) remoteImageOverlayColor = color;
  }

  return (
    <>
      <div
        ref={viewportRef}
        className={`${styles.boardViewport} ${panning ? styles.panning : ""}`}
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
        onAuxClick={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
      >
        <div className={styles.boardStage}>
          <div
            ref={worldRef}
            className={styles.boardWorld}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <div
              className={`${styles.puzzleFrame} ${complete ? styles.complete : ""}`}
              style={{
                left: `${margin}px`,
                top: `${margin}px`,
                width: `${layout.boardWidth}px`,
                height: `${layout.boardHeight}px`,
              }}
            />
            {imageOverlayPosition && (
              <div
                className={`${styles.imageOverlay} ${imageOverlaySelected ? styles.selected : ""} ${remoteImageOverlayColor ? styles.remoteSelected : ""} ${imageOverlayLocked ? styles.overlayLocked : ""}`}
                style={{
                  left: `${margin + imageOverlayPosition.x}px`,
                  top: `${margin + imageOverlayPosition.y}px`,
                  width: `${layout.boardWidth}px`,
                  height: `${layout.boardHeight}px`,
                  "--my-selection-color": myColor ?? "transparent",
                  "--remote-selection-color": remoteImageOverlayColor ?? "transparent",
                } as React.CSSProperties & Record<"--my-selection-color" | "--remote-selection-color", string>}
                onPointerDown={onImageOverlayPointerDown}
              >
                <img
                  src={imageDataUrl}
                  alt="元の画像"
                  className={styles.imageOverlayImg}
                  style={{ opacity: imageOverlayOpacity }}
                  draggable={false}
                />
              </div>
            )}
            {pieces.map((piece) => {
              const geometry = layout.pieces[piece.id];
              const remoteColor = remotePieceColors.get(piece.id) ?? null;
              return (
                <button
                  key={piece.id}
                  className={`${styles.piece} ${piece.locked ? styles.locked : ""}`}
                  style={{
                    left: `${margin + piece.x}px`,
                    top: `${margin + piece.y}px`,
                    width: `${layout.pieceWidth}px`,
                    height: `${layout.pieceHeight}px`,
                    zIndex: piece.z,
                  } as React.CSSProperties}
                  aria-label={`piece ${piece.id + 1}`}
                  onPointerDown={(e) => onPiecePointerDown(e, piece)}
                >
                  <JigsawPiece
                    geometry={geometry}
                    imageDataUrl={imageDataUrl}
                    layout={layout}
                    pieceId={piece.id}
                    locked={piece.locked}
                    selected={selectedPieceIds.has(piece.id)}
                    selectionColor={myColor}
                    remoteColor={remoteColor}
                  />
                </button>
              );
            })}
            {selectionBox && (
              <div
                className={styles.selectionBox}
                style={{
                  left: `${selectionBox.x}px`,
                  top: `${selectionBox.y}px`,
                  width: `${selectionBox.width}px`,
                  height: `${selectionBox.height}px`,
                }}
              />
            )}
            {remoteCursors.map((cursor) => (
              <div
                key={cursor.participantId}
                className={`${styles.remoteCursor}${activeRemoteCursorIds.has(cursor.participantId) ? ` ${styles.dragging}` : ""}`}
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

      {imageOverlaySelected && imageOverlayPosition && (() => {
        const vpW = viewportRef.current?.clientWidth ?? 0;
        const vpH = viewportRef.current?.clientHeight ?? 0;
        const imgLeft = pan.x + (margin + imageOverlayPosition.x) * zoom;
        const imgTop = pan.y + (margin + imageOverlayPosition.y) * zoom;
        const imgRight = pan.x + (margin + imageOverlayPosition.x + layout.boardWidth) * zoom;
        const imgBottom = pan.y + (margin + imageOverlayPosition.y + layout.boardHeight) * zoom;
        if (vpW <= 0 || vpH <= 0 || imgLeft >= vpW || imgRight <= 0 || imgTop >= vpH || imgBottom <= 0) return null;
        const tbW = toolbarRef.current?.offsetWidth ?? 220;
        const tbH = toolbarRef.current?.offsetHeight ?? 36;
        const M = 8;
        const rawX = pan.x + (margin + imageOverlayPosition.x + layout.boardWidth / 2) * zoom;
        const rawTop = pan.y + (margin + imageOverlayPosition.y) * zoom - tbH - M;
        const left = Math.max(tbW / 2 + M, Math.min(vpW - tbW / 2 - M, rawX));
        const top = Math.max(M, Math.min(vpH - tbH - M, rawTop));
        return (
          <div
            ref={toolbarRef}
            className={styles.imageOverlayToolbar}
            style={{ left: `${left}px`, top: `${top}px` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`${styles.toolbarBtn} ${imageOverlayLocked ? styles.toolbarBtnActive : ""}`}
              onClick={onToggleImageLock}
              title={imageOverlayLocked ? "ロック解除" : "ロック"}
            >
              {imageOverlayLocked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
            <div className={styles.toolbarDivider} />
            <div className={styles.toolbarOpacityGroup}>
              <span className={styles.toolbarLabel}>不透明度</span>
              <input
                className={styles.toolbarSlider}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={imageOverlayOpacity}
                style={{ "--slider-pct": `${imageOverlayOpacity * 100}%` } as React.CSSProperties}
                onChange={(e) => onChangeImageOpacity(Number(e.target.value))}
              />
              <span className={styles.toolbarVal}>{Math.round(imageOverlayOpacity * 100)}%</span>
            </div>
          </div>
        );
      })()}

      <div className={styles.zoomControls}>
        <button onClick={onZoomOut} disabled={zoom <= MIN_ZOOM} title="縮小">
          <Minus size={13} />
        </button>
        <span className={styles.zoomPct}>{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn} disabled={zoom >= MAX_ZOOM} title="拡大">
          <Plus size={13} />
        </button>
        <button onClick={onResetZoom} title="表示をリセット">
          <Maximize2 size={13} />
        </button>
      </div>

      <div className={`${styles.canvasStatus} ${complete ? styles.complete : ""}`}>
        {complete ? "完成 ✓" : loadingSummary}
      </div>
    </>
  );
}

export { ZOOM_STEP };
