import { formatDuration } from "../utils/format";
import styles from "./CompletionOverlay.module.css";

type Props = {
  pieceCount: number;
  elapsedMs: number | null;
  onBackToMenu: () => void;
  onClose: () => void;
};

export function CompletionOverlay({ pieceCount, elapsedMs, onBackToMenu, onClose }: Props) {
  return (
    <div className={styles.completionOverlay} role="dialog" aria-modal="true" aria-label="パズル完成">
      <div className={styles.completionCard}>
        <p className={styles.completionEyebrow}>Puzzle Complete</p>
        <h2 className={styles.completionTitle}>おめでとう<em>！</em></h2>
        <p className={styles.completionDesc}>
          {pieceCount} ピースのパズルを完成させました。
        </p>
        {elapsedMs !== null && (
          <div className={styles.completionTime}>
            <span className={styles.completionTimeLabel}>クリアタイム</span>
            <span className={styles.completionTimeValue}>{formatDuration(elapsedMs)}</span>
          </div>
        )}
        <div className={styles.completionActions}>
          <button className={`${styles.primary} ${styles.completionBtn}`} onClick={onBackToMenu}>
            メニューに戻る
          </button>
          <button className={styles.completionBtn} onClick={onClose}>
            パズルを見る
          </button>
        </div>
      </div>
    </div>
  );
}
