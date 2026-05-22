import { ZoomIn, ZoomOut } from "lucide-solid";
import { MAX_ZOOM, MIN_ZOOM } from "../hooks/use-viewport";
import { css, cx } from "../../styled-system/css";
import { fadeUpIn, glassIconButton, glassPanel } from "../styles/recipes";

const root = css({
  position: "absolute",
  bottom: "16px",
  right: "16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  padding: "4px",
  gap: "2px",
  md: { bottom: "10px", right: "10px" },
});

const fitBtn = css({
  height: "28px",
  minHeight: "28px",
  padding: "0 8px",
  background: "transparent",
  border: "1px solid transparent",
  color: "glass.textDim",
  borderRadius: "sm",
  font: "600 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.06em",
  opacity: 0.85,
  _hover: {
    _enabled: {
      background: "color-mix(in oklch, {colors.glass.text} 10%, transparent)",
      color: "glass.text",
      opacity: 1,
    },
  },
  sm: { display: "none" },
});

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

export function CornerPanelBR(props: Props) {
  return (
    <div class={cx(glassPanel(), root, fadeUpIn(220))}>
      <button
        class={glassIconButton()}
        onClick={props.onZoomIn}
        disabled={props.zoom >= MAX_ZOOM}
        title="拡大"
        aria-label="拡大"
      >
        <ZoomIn size={15} />
      </button>
      <button
        class={fitBtn}
        onClick={props.onResetZoom}
        title="全体表示"
        aria-label="全体表示"
      >
        FIT
      </button>
      <button
        class={glassIconButton()}
        onClick={props.onZoomOut}
        disabled={props.zoom <= MIN_ZOOM}
        title="縮小"
        aria-label="縮小"
      >
        <ZoomOut size={15} />
      </button>
    </div>
  );
}
