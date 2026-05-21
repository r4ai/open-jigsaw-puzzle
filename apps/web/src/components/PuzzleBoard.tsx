import { Show, createMemo, onCleanup, onMount } from "solid-js";
import { Lock, LockOpen, Maximize2, Minus, Plus } from "lucide-solid";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { RemoteSelection } from "../hooks/usePuzzle";
import type { RemoteCursor } from "../hooks/useRemoteCursors";
import type { PanOffset } from "../hooks/useViewport";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "../hooks/useViewport";
import { PiecesLayer } from "./PiecesLayer";
import { RemoteCursorsLayer } from "./RemoteCursorsLayer";
import { participantColor } from "../utils/participant";
import {
  boardStage,
  boardViewport,
  boardWorld,
  canvasStatus,
  canvasStatusComplete,
  frameComplete,
  imageOverlay,
  imageOverlayImg,
  imageOverlayToolbar,
  overlayLocked,
  overlayRemoteSelected,
  overlaySelected,
  panning as panningCls,
  puzzleFrame,
  selectionBox as selectionBoxCls,
  toolbarBtn,
  toolbarBtnActive,
  toolbarDivider,
  toolbarLabel,
  toolbarOpacityGroup,
  toolbarSlider,
  toolbarVal,
  zoomControls,
  zoomPct,
} from "./PuzzleBoard.styles";

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
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onApplyPinch: (distFactor: number, prevMidX: number, prevMidY: number, newMidX: number, newMidY: number) => void;
  onSetPinching: (pinching: boolean) => void;
  registerPieceElement: (id: number, el: HTMLElement | null) => void;
};

export function PuzzleBoard(props: Props) {
  let viewportRef: HTMLDivElement | undefined;
  let worldRef: HTMLDivElement | undefined;
  let toolbarRef: HTMLDivElement | undefined;

  // ピンチズーム — DOM 直接登録
  onMount(() => {
    const el = viewportRef;
    if (!el) return;

    const touches = new Map<number, { x: number; y: number }>();
    let prevMidX = 0, prevMidY = 0, prevDist = 1;

    function midAndDist() {
      const [a, b] = [...touches.values()];
      return {
        midX: (a!.x + b!.x) / 2,
        midY: (a!.y + b!.y) / 2,
        dist: Math.hypot(b!.x - a!.x, b!.y - a!.y),
      };
    }

    function onDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const { midX, midY, dist } = midAndDist();
        prevMidX = midX; prevMidY = midY; prevDist = dist;
        e.preventDefault();
        props.onSetPinching(true);
      }
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size < 2) return;
      const { midX, midY, dist } = midAndDist();
      e.preventDefault();
      if (prevDist <= 0 || dist <= 0) {
        prevMidX = midX; prevMidY = midY; prevDist = dist;
        return;
      }
      props.onApplyPinch(dist / prevDist, prevMidX, prevMidY, midX, midY);
      prevMidX = midX; prevMidY = midY; prevDist = dist;
    }

    function onUp(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      touches.delete(e.pointerId);
      if (touches.size < 2) props.onSetPinching(false);
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    onCleanup(() => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    });
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

  // ツールバー位置の派生計算（既存ロジック踏襲）
  const toolbarPlacement = createMemo(() => {
    if (!props.imageOverlaySelected || !props.imageOverlayPosition) return null;
    const vp = props.getViewportEl();
    const vpW = vp?.clientWidth ?? 0;
    const vpH = vp?.clientHeight ?? 0;
    const imgLeft = props.pan.x + (props.margin + props.imageOverlayPosition.x) * props.zoom;
    const imgTop = props.pan.y + (props.margin + props.imageOverlayPosition.y) * props.zoom;
    const imgRight =
      props.pan.x + (props.margin + props.imageOverlayPosition.x + props.layout.boardWidth) * props.zoom;
    const imgBottom =
      props.pan.y + (props.margin + props.imageOverlayPosition.y + props.layout.boardHeight) * props.zoom;
    if (vpW <= 0 || vpH <= 0 || imgLeft >= vpW || imgRight <= 0 || imgTop >= vpH || imgBottom <= 0) return null;
    const tbW = toolbarRef?.offsetWidth ?? 220;
    const tbH = toolbarRef?.offsetHeight ?? 36;
    const M = 8;
    const rawX = props.pan.x + (props.margin + props.imageOverlayPosition.x + props.layout.boardWidth / 2) * props.zoom;
    const rawTop = props.pan.y + (props.margin + props.imageOverlayPosition.y) * props.zoom - tbH - M;
    const left = Math.max(tbW / 2 + M, Math.min(vpW - tbW / 2 - M, rawX));
    const top = Math.max(M, Math.min(vpH - tbH - M, rawTop));
    return { left, top };
  });

  return (
    <>
      <div
        ref={(el) => {
          viewportRef = el;
          props.setViewportEl(el);
        }}
        class={`${boardViewport} ${props.panning ? panningCls : ""}`}
        style={{
          "background-position": `${props.pan.x}px ${props.pan.y}px`,
          "background-size": `${28 * props.zoom}px ${28 * props.zoom}px`,
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
            ref={(el) => {
              worldRef = el;
              props.setWorldEl(el);
            }}
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
      </div>

      <Show when={toolbarPlacement()}>
        {(p) => (
          <div
            ref={(el) => (toolbarRef = el)}
            class={imageOverlayToolbar}
            role="toolbar"
            aria-label="画像オーバーレイ"
            style={{ left: `${p().left}px`, top: `${p().top}px` }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              class={`${toolbarBtn} ${props.imageOverlayLocked ? toolbarBtnActive : ""}`}
              onClick={() => props.onToggleImageLock()}
              title={props.imageOverlayLocked ? "ロック解除" : "ロック"}
            >
              {props.imageOverlayLocked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
            <div class={toolbarDivider} />
            <div class={toolbarOpacityGroup}>
              <span class={toolbarLabel}>不透明度</span>
              <input
                class={toolbarSlider}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={props.imageOverlayOpacity}
                style={{ "--slider-pct": `${props.imageOverlayOpacity * 100}%` }}
                onInput={(e) => props.onChangeImageOpacity(Number(e.currentTarget.value))}
              />
              <span class={toolbarVal}>
                {Math.round(props.imageOverlayOpacity * 100)}%
              </span>
            </div>
          </div>
        )}
      </Show>

      <div class={zoomControls}>
        <button onClick={() => props.onZoomOut()} disabled={props.zoom <= MIN_ZOOM} title="縮小">
          <Minus size={13} />
        </button>
        <span class={zoomPct}>{Math.round(props.zoom * 100)}%</span>
        <button onClick={() => props.onZoomIn()} disabled={props.zoom >= MAX_ZOOM} title="拡大">
          <Plus size={13} />
        </button>
        <button onClick={() => props.onResetZoom()} title="表示をリセット">
          <Maximize2 size={13} />
        </button>
      </div>

      <div class={`${canvasStatus} ${props.complete ? canvasStatusComplete : ""}`}>
        {props.complete ? "完成 ✓" : props.loadingSummary}
      </div>
    </>
  );
}

export { ZOOM_STEP };
