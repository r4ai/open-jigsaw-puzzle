type Props = {
  pieceCount: number;
  onBackToMenu: () => void;
  onClose: () => void;
};

export function CompletionOverlay({ pieceCount, onBackToMenu, onClose }: Props) {
  return (
    <div className="completion-overlay" role="dialog" aria-modal="true" aria-label="パズル完成">
      <div className="completion-card">
        <p className="completion-eyebrow">Puzzle Complete</p>
        <h2 className="completion-title">おめでとう<em>！</em></h2>
        <p className="completion-desc">
          {pieceCount} ピースのパズルを完成させました。
        </p>
        <div className="completion-actions">
          <button className="primary completion-btn" onClick={onBackToMenu}>
            メニューに戻る
          </button>
          <button className="completion-btn" onClick={onClose}>
            パズルを見る
          </button>
        </div>
      </div>
    </div>
  );
}
