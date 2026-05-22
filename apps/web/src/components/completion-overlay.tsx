import { Clock, Home, Puzzle, Sparkles } from "lucide-solid";
import { formatDuration } from "../utils/format";
import {
  actions,
  card,
  heading,
  headingGroup,
  iconCircle,
  overlay,
  primaryBtn,
  secondaryBtn,
  statBox,
  statIcon,
  statLabel,
  statValue,
  statsRow,
  subheading,
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
      class={overlay}
      role="dialog"
      aria-modal="true"
      aria-label="パズル完成"
    >
      <div class={card}>
        <div class={iconCircle}>
          <Sparkles size={36} />
        </div>

        <div class={headingGroup}>
          <h2 class={heading}>完成！</h2>
          <p class={subheading}>みんなで全てのピースを置きました</p>
        </div>

        <div class={statsRow}>
          <div class={statBox}>
            <span class={statIcon}>
              <Clock size={15} />
            </span>
            <span class={statValue}>
              {props.elapsedMs !== null ? formatDuration(props.elapsedMs) : "–"}
            </span>
            <span class={statLabel}>経過時間</span>
          </div>
          <div class={statBox}>
            <span class={statIcon}>
              <Puzzle size={15} />
            </span>
            <span class={statValue}>{props.pieceCount}</span>
            <span class={statLabel}>ピース</span>
          </div>
        </div>

        <div class={actions}>
          <button class={secondaryBtn} onClick={props.onBackToMenu}>
            <Home size={14} />
            ホームへ
          </button>
          <button class={primaryBtn} onClick={props.onClose}>
            続ける
          </button>
        </div>
      </div>
    </div>
  );
}
