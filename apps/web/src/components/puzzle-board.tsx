import { Show, createMemo } from "solid-js";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { RemoteSelection } from "../hooks/use-puzzle";
import type { RemoteCursor } from "../hooks/use-remote-cursors";
import type { PanOffset } from "../hooks/use-viewport";
import { ZOOM_STEP } from "../hooks/use-viewport";
import { usePinchZoom } from "../hooks/use-pinch-zoom";
import { PiecesLayer } from "./pieces-layer";
import { RemoteCursorsLayer } from "./remote-cursors-layer";
import { ImageOverlayToolbar } from "./image-overlay-toolbar";
import { participantColor } from "../utils/participant";
import {
  boardStage,
  boardViewport,
  boardWorld,
  frameComplete,
  imageOverlay,
  imageOverlayImg,
  overlayLocked,
  overlayRemoteSelected,
  overlaySelected,
  panning as panningCls,
  puzzleFrame,
  selectionBox as selectionBoxCls,
} from "./puzzle-board.styles";

type Props = {
  layout: PuzzleLayout;
  imageDataUrl: string;
  pieces: BoardPiece[];
  zoom: number;
  pan: PanOffset;
  panning: boolean;
  margin: number;
  complete: boolean;
  remoteCursors: RemoteCursor[];
  activeRemoteCursorIds: Set<string>;
  selectedPieceIds: Set<number>;
  imageOverlaySelected: boolean;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  remoteSelections: RemoteSelection[];
  myId: string | null;
  setViewportEl: (el: HTMLDivElement | undefined) => void;
  setWorldEl: (el: HTMLDivElement | undefined) => void;
  getViewportEl: () => HTMLDivElement | undefined;
  imageOverlayPosition: { x: number; y: number } | null;
  imageOverlayLocked: boolean;
  imageOverlayOpacity: number;
  onToggleImageLock: () => void;
  onChangeImageOpacity: (value: number) => void;
  onImageOverlayPointerDown: (e: PointerEvent) => void;
  onPiecePointerDown: (e: PointerEvent, piece: BoardPiece) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
  onPointerLeave: () => void;
  onViewportPointerDown: (e: PointerEvent) => void;
  onWheel: (e: WheelEvent) => void;
  onApplyPinch: (
    distFactor: number,
    prevMidX: number,
    prevMidY: number,
    newMidX: number,
    newMidY: number,
  ) => void;
  onSetPinching: (pinching: boolean) => void;
  registerPieceElement: (id: number, el: HTMLElement | null) => void;
};

/** Side length (px, at zoom 1) of the dotted background grid cell. */
const BACKGROUND_GRID_SIZE = 24;

export function PuzzleBoard(props: Props) {
  let viewportRef: HTMLDivElement | undefined;

  usePinchZoom({
    getElement: () => viewportRef,
    onApplyPinch: (e) =>
      props.onApplyPinch(e.distFactor, e.prevMidX, e.prevMidY, e.newMidX, e.newMidY),
    onSetPinching: props.onSetPinching,
  });

  const myColor = () => (props.myId ? participantColor(props.myId) : null);

  const colorMaps = createMemo(() => {
    const pieceColors = new Map<number, string>();
    let imageColor: string | null = null;
    for (const selection of props.remoteSelections) {
      const color = participantColor(selection.participantId);
      for (const pieceId of selection.pieceIds) {
        if (!pieceColors.has(pieceId)) pieceColors.set(pieceId, color);
      }
      if (selection.imageOverlaySelected && !imageColor) imageColor = color;
    }
    return { remotePieceColors: pieceColors, remoteImageOverlayColor: imageColor };
  });

  return (
    <div
      ref={(el) => {
        viewportRef = el;
        props.setViewportEl(el);
      }}
      class={`${boardViewport} ${props.panning ? panningCls : ""}`}
      style={{
        "background-position": `${props.pan.x}px ${props.pan.y}px`,
        "background-size": `${BACKGROUND_GRID_SIZE * props.zoom}px ${BACKGROUND_GRID_SIZE * props.zoom}px`,
      }}
      onPointerDown={(e) => props.onViewportPointerDown(e)}
      onPointerMove={(e) => props.onPointerMove(e)}
      onPointerUp={(e) => props.onPointerUp(e)}
      onPointerCancel={(e) => props.onPointerCancel(e)}
      onPointerLeave={() => props.onPointerLeave()}
      onWheel={(e) => props.onWheel(e)}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
    >
      <div class={boardStage}>
        <div
          ref={(el) => props.setWorldEl(el)}
          class={boardWorld}
          style={{
            transform: `translate(${props.pan.x}px, ${props.pan.y}px) scale(${props.zoom})`,
          }}
        >
          <div
            class={`${puzzleFrame} ${props.complete ? frameComplete : ""}`}
            style={{
              left: `${props.margin}px`,
              top: `${props.margin}px`,
              width: `${props.layout.boardWidth}px`,
              height: `${props.layout.boardHeight}px`,
            }}
          />
          <Show when={props.imageOverlayPosition}>
            {(pos) => (
              <div
                class={`${imageOverlay} ${props.imageOverlaySelected ? overlaySelected : ""} ${colorMaps().remoteImageOverlayColor ? overlayRemoteSelected : ""} ${props.imageOverlayLocked ? overlayLocked : ""}`}
                style={{
                  left: `${props.margin + pos().x}px`,
                  top: `${props.margin + pos().y}px`,
                  width: `${props.layout.boardWidth}px`,
                  height: `${props.layout.boardHeight}px`,
                  "--my-selection-color": myColor() ?? "transparent",
                  "--remote-selection-color":
                    colorMaps().remoteImageOverlayColor ?? "transparent",
                }}
                onPointerDown={(e) => props.onImageOverlayPointerDown(e)}
              >
                <img
                  src={props.imageDataUrl}
                  alt="元の画像"
                  class={imageOverlayImg}
                  style={{ opacity: props.imageOverlayOpacity }}
                  draggable={false}
                />
              </div>
            )}
          </Show>
          <PiecesLayer
            pieces={props.pieces}
            layout={props.layout}
            imageDataUrl={props.imageDataUrl}
            margin={props.margin}
            selectedPieceIds={props.selectedPieceIds}
            myColor={myColor()}
            remotePieceColors={colorMaps().remotePieceColors}
            onPiecePointerDown={props.onPiecePointerDown}
            registerPieceElement={props.registerPieceElement}
          />
          <Show when={props.selectionBox}>
            {(box) => (
              <div
                class={selectionBoxCls}
                style={{
                  left: `${box().x}px`,
                  top: `${box().y}px`,
                  width: `${box().width}px`,
                  height: `${box().height}px`,
                }}
              />
            )}
          </Show>
          <RemoteCursorsLayer
            cursors={props.remoteCursors}
            activeIds={props.activeRemoteCursorIds}
          />
        </div>
      </div>

      <Show when={props.imageOverlaySelected && props.imageOverlayPosition}>
        <ImageOverlayToolbar
          layout={props.layout}
          position={props.imageOverlayPosition!}
          pan={props.pan}
          zoom={props.zoom}
          margin={props.margin}
          locked={props.imageOverlayLocked}
          opacity={props.imageOverlayOpacity}
          getViewportEl={props.getViewportEl}
          onToggleLock={props.onToggleImageLock}
          onChangeOpacity={props.onChangeImageOpacity}
        />
      </Show>
    </div>
  );
}

export { ZOOM_STEP };
