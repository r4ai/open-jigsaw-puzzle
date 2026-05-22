import { Show } from "solid-js";
import { Image as ImageIcon, Loader2 } from "lucide-solid";
import {
  dropArea,
  iconWrap,
  loadingCopy,
  loadingIcon,
  primaryText,
  root,
  secondaryText,
  textBlock,
  uploadButton,
} from "./empty-board.styles";

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
      class={`${root} ${props.isHost ? dropArea : ""}`}
      onDragOver={(e) => props.onDragOver(e)}
      onDrop={(e) => props.onDrop(e)}
    >
      <Show
        when={props.isHost}
        fallback={
          <>
            <Loader2 class={loadingIcon} size={28} />
            <div class={loadingCopy}>
              <strong>
                ホストまたは画像を持つ参加者からの配布を待っています
              </strong>
              <span>{props.statusText}</span>
            </div>
          </>
        }
      >
        <div class={iconWrap}>
          <ImageIcon size={28} />
        </div>
        <div class={textBlock}>
          <p class={primaryText}>画像を選ぶとパズルを開始できます</p>
          <p class={secondaryText}>{props.statusText}</p>
        </div>
        <button class={uploadButton} onClick={props.onPickImage}>
          <ImageIcon size={15} />
          画像を選ぶ
        </button>
      </Show>
    </div>
  );
}
