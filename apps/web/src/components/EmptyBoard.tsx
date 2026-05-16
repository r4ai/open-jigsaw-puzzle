import { ImagePlus, Loader2 } from "lucide-react";

type Props = {
  isHost: boolean;
  statusText: string;
  onPickImage: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
};

export function EmptyBoard({ isHost, statusText, onPickImage, onDragOver, onDrop }: Props) {
  return (
    <div
      className={`empty-board ${isHost ? "drop-target" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isHost ? (
        <>
          <button className="empty-upload-button" onClick={onPickImage}>
            <ImagePlus size={18} />
            画像を選択
          </button>
          <span className="empty-hint">ドラッグ&ドロップ可</span>
          <span className="empty-sub">{statusText}</span>
        </>
      ) : (
        <>
          <Loader2 className="loading-icon" size={28} />
          <div className="loading-copy">
            <strong>ホストまたは画像を持つ参加者からの配布を待っています</strong>
            <span>{statusText}</span>
          </div>
        </>
      )}
    </div>
  );
}
