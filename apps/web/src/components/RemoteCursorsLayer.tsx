import { For } from "solid-js";
import { MousePointer2 } from "lucide-solid";
import type { RemoteCursor } from "../hooks/useRemoteCursors";
import { participantColor } from "../utils/participant";
import { cursorDragging, remoteCursor } from "./PuzzleBoard.styles";

type Props = {
  cursors: RemoteCursor[];
  activeIds: Set<string>;
};

export function RemoteCursorsLayer(props: Props) {
  return (
    <For each={props.cursors}>
      {(cursor) => (
        <div
          class={`${remoteCursor}${props.activeIds.has(cursor.participantId) ? ` ${cursorDragging}` : ""}`}
          style={{
            "--cursor-x": `${cursor.x}px`,
            "--cursor-y": `${cursor.y}px`,
            "--cursor-color": participantColor(cursor.participantId),
          }}
          title={cursor.name}
        >
          <MousePointer2 size={16} />
          <span>{cursor.name}</span>
        </div>
      )}
    </For>
  );
}
