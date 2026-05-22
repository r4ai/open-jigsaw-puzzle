import { Maximize2, Minus, Plus } from "lucide-solid";
import { MAX_ZOOM, MIN_ZOOM } from "../hooks/use-viewport";
import { zoomControls, zoomPct } from "./puzzle-board.styles";

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
};

export function ZoomControls(props: Props) {
  return (
    <div class={zoomControls}>
      <button onClick={props.onZoomOut} disabled={props.zoom <= MIN_ZOOM} title="縮小">
        <Minus size={13} />
      </button>
      <span class={zoomPct}>{Math.round(props.zoom * 100)}%</span>
      <button onClick={props.onZoomIn} disabled={props.zoom >= MAX_ZOOM} title="拡大">
        <Plus size={13} />
      </button>
      <button onClick={props.onResetZoom} title="表示をリセット">
        <Maximize2 size={13} />
      </button>
    </div>
  );
}
