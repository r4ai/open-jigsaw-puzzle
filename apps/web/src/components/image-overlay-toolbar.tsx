import { Show, createMemo, createSignal, onCleanup } from "solid-js";
import { Lock, LockOpen } from "lucide-solid";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { PanOffset } from "../hooks/use-viewport";
import {
  imageOverlayToolbar,
  toolbarBtn,
  toolbarBtnActive,
  toolbarDivider,
  toolbarLabel,
  toolbarOpacityGroup,
  toolbarSlider,
  toolbarVal,
} from "./puzzle-board.styles";

const DEFAULT_SIZE = { width: 220, height: 36 };
const EDGE_MARGIN = 8;

type Props = {
  layout: PuzzleLayout;
  position: { x: number; y: number };
  pan: PanOffset;
  zoom: number;
  margin: number;
  locked: boolean;
  opacity: number;
  getViewportEl: () => HTMLDivElement | undefined;
  onToggleLock: () => void;
  onChangeOpacity: (value: number) => void;
};

/**
 * Floating toolbar for the image overlay. Its placement tracks the overlay's
 * top edge while staying inside the viewport.
 */
export function ImageOverlayToolbar(props: Props) {
  const [size, setSize] = createSignal(DEFAULT_SIZE);
  let toolbarEl: HTMLDivElement | undefined;
  let observer: ResizeObserver | undefined;

  function measure() {
    if (!toolbarEl) {
      setSize(DEFAULT_SIZE);
      return;
    }
    setSize({
      width: toolbarEl.offsetWidth || DEFAULT_SIZE.width,
      height: toolbarEl.offsetHeight || DEFAULT_SIZE.height,
    });
  }

  function setRef(el: HTMLDivElement) {
    toolbarEl = el;
    observer?.disconnect();
    measure();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
  }

  onCleanup(() => observer?.disconnect());

  const placement = createMemo(() => {
    const vp = props.getViewportEl();
    const vpW = vp?.clientWidth ?? 0;
    const vpH = vp?.clientHeight ?? 0;
    const imgLeft = props.pan.x + (props.margin + props.position.x) * props.zoom;
    const imgTop = props.pan.y + (props.margin + props.position.y) * props.zoom;
    const imgRight = imgLeft + props.layout.boardWidth * props.zoom;
    const imgBottom = imgTop + props.layout.boardHeight * props.zoom;
    if (vpW <= 0 || vpH <= 0 || imgLeft >= vpW || imgRight <= 0 || imgTop >= vpH || imgBottom <= 0) {
      return null;
    }
    const { width: tbW, height: tbH } = size();
    const rawLeft = imgLeft + (props.layout.boardWidth * props.zoom) / 2;
    const rawTop = imgTop - tbH - EDGE_MARGIN;
    return {
      left: Math.max(tbW / 2 + EDGE_MARGIN, Math.min(vpW - tbW / 2 - EDGE_MARGIN, rawLeft)),
      top: Math.max(EDGE_MARGIN, Math.min(vpH - tbH - EDGE_MARGIN, rawTop)),
    };
  });

  return (
    <Show when={placement()}>
      {(p) => (
        <div
          ref={setRef}
          class={imageOverlayToolbar}
          role="toolbar"
          aria-label="画像オーバーレイ"
          style={{ left: `${p().left}px`, top: `${p().top}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            class={`${toolbarBtn} ${props.locked ? toolbarBtnActive : ""}`}
            onClick={props.onToggleLock}
            title={props.locked ? "ロック解除" : "ロック"}
          >
            {props.locked ? <Lock size={13} /> : <LockOpen size={13} />}
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
              value={props.opacity}
              style={{ "--slider-pct": `${props.opacity * 100}%` }}
              onInput={(e) => props.onChangeOpacity(Number(e.currentTarget.value))}
            />
            <span class={toolbarVal}>{Math.round(props.opacity * 100)}%</span>
          </div>
        </div>
      )}
    </Show>
  );
}
