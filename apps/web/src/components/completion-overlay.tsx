import { Show } from "solid-js";
import { formatDuration } from "../utils/format";
import {
  completionActions,
  completionBtn,
  completionCard,
  completionDesc,
  completionEyebrow,
  completionOverlay,
  completionTime,
  completionTimeLabel,
  completionTimeValue,
  completionTitle,
  primary,
} from "./completion-overlay.styles";

type Props = {
  pieceCount: number;
  elapsedMs: number | null;
  onBackToMenu: () => void;
  onClose: () => void;
};

export function CompletionOverlay(props: Props) {
  return (
    <div
      class={completionOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="パズル完成"
    >
      <div class={completionCard}>
        <p class={completionEyebrow}>Puzzle Complete</p>
        <h2 class={completionTitle}>
          おめでとう<em>！</em>
        </h2>
        <p class={completionDesc}>
          {props.pieceCount} ピースのパズルを完成させました。
        </p>
        <Show when={props.elapsedMs !== null}>
          <div class={completionTime}>
            <span class={completionTimeLabel}>クリアタイム</span>
            <span class={completionTimeValue}>
              {formatDuration(props.elapsedMs!)}
            </span>
          </div>
        </Show>
        <div class={completionActions}>
          <button
            class={`${primary} ${completionBtn}`}
            onClick={props.onBackToMenu}
          >
            メニューに戻る
          </button>
          <button class={completionBtn} onClick={props.onClose}>
            パズルを見る
          </button>
        </div>
      </div>
    </div>
  );
}
