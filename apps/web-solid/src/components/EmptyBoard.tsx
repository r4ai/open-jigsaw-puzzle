import { Show } from "solid-js";
import { ImagePlus, Loader2 } from "lucide-solid";
import {
  dropTarget,
  emptyBoard,
  emptyHint,
  emptySub,
  emptyUploadButton,
  loadingCopy,
  loadingIcon,
} from "./EmptyBoard.styles";

type Props = {
  isHost: boolean;
  statusText: string;
  onPickImage: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
};

export function EmptyBoard(props: Props) {
  return (
    <div
      class={`${emptyBoard} ${props.isHost ? dropTarget : ""}`}
      onDragOver={(e) => props.onDragOver(e)}
      onDrop={(e) => props.onDrop(e)}
    >
      <Show
        when={props.isHost}
        fallback={
          <>
            <Loader2 class={loadingIcon} size={28} />
            <div class={loadingCopy}>
              <strong>ホストまたは画像を持つ参加者からの配布を待っています</strong>
              <span>{props.statusText}</span>
            </div>
          </>
        }
      >
        <button class={emptyUploadButton} onClick={props.onPickImage}>
          <ImagePlus size={18} />
          画像を選択
        </button>
        <span class={emptyHint}>ドラッグ&ドロップ可</span>
        <span class={emptySub}>{props.statusText}</span>
      </Show>
    </div>
  );
}
