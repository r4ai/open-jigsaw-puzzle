import { memo } from "react";
import type { PieceGeometry, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import { createPiecePath } from "../utils/piece-path";
import styles from "./JigsawPiece.module.css";

type Props = {
  geometry: PieceGeometry;
  imageDataUrl: string;
  layout: PuzzleLayout;
  pieceId: number;
  locked: boolean;
  selected?: boolean;
  selectionColor?: string | null;
  remoteColor?: string | null;
};

export const JigsawPiece = memo(function JigsawPiece({ geometry, imageDataUrl, layout, pieceId, locked, selected, selectionColor, remoteColor }: Props) {
  const tabSize = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
  const path = createPiecePath(layout.pieceWidth, layout.pieceHeight, geometry, tabSize);

  return (
    <svg
      aria-hidden="true"
      className={styles.pieceSvg}
      style={{
        left: `${(-tabSize / layout.pieceWidth) * 100}%`,
        top: `${(-tabSize / layout.pieceHeight) * 100}%`,
        width: `${((layout.pieceWidth + tabSize * 2) / layout.pieceWidth) * 100}%`,
        height: `${((layout.pieceHeight + tabSize * 2) / layout.pieceHeight) * 100}%`,
        "--selection-color": selectionColor ?? "transparent",
        "--remote-color": remoteColor ?? "transparent",
      } as React.CSSProperties}
      viewBox={`${-tabSize} ${-tabSize} ${layout.pieceWidth + tabSize * 2} ${layout.pieceHeight + tabSize * 2}`}
    >
      <defs>
        <clipPath id={`piece-clip-${pieceId}`}>
          <path d={path} />
        </clipPath>
      </defs>
      <g
        className={locked ? styles.pieceShapeLocked : styles.pieceShape}
        clipPath={`url(#piece-clip-${pieceId})`}
      >
        <image
          href={imageDataUrl}
          x={-geometry.sourceX}
          y={-geometry.sourceY}
          width={layout.boardWidth}
          height={layout.boardHeight}
          preserveAspectRatio="none"
        />
      </g>
      {remoteColor && (
        <>
          <path className={styles.remoteSelectionGlow} d={path} />
          <path className={styles.remoteSelectionStroke} d={path} />
        </>
      )}
      {selected && (
        <>
          <path className={styles.selectionGlow} d={path} />
          <path className={styles.selectionStroke} d={path} />
        </>
      )}
      <path className={`${styles.pieceEdge} ${locked ? styles.pieceEdgeLocked : ""}`} d={path} />
    </svg>
  );
});
