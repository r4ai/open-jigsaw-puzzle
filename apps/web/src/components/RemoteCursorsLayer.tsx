import { memo } from "react";
import { MousePointer2 } from "lucide-react";
import type { RemoteCursor } from "../hooks/useRemoteCursors";
import { participantColor } from "../utils/participant";
import styles from "./PuzzleBoard.module.css";

type Props = {
  cursors: RemoteCursor[];
  activeIds: Set<string>;
};

export const RemoteCursorsLayer = memo(function RemoteCursorsLayer({ cursors, activeIds }: Props) {
  return (
    <>
      {cursors.map((cursor) => (
        <div
          key={cursor.participantId}
          className={`${styles.remoteCursor}${activeIds.has(cursor.participantId) ? ` ${styles.dragging}` : ""}`}
          style={{
            "--cursor-x": `${cursor.x}px`,
            "--cursor-y": `${cursor.y}px`,
            "--cursor-color": participantColor(cursor.participantId),
          } as React.CSSProperties & Record<"--cursor-x" | "--cursor-y" | "--cursor-color", string>}
          title={cursor.name}
        >
          <MousePointer2 size={16} />
          <span>{cursor.name}</span>
        </div>
      ))}
    </>
  );
});
