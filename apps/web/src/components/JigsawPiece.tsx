import { memo } from "react";
import type { PieceGeometry, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import { createPiecePath } from "../utils/piece-path";

type Props = {
  geometry: PieceGeometry;
  imageDataUrl: string;
  layout: PuzzleLayout;
  pieceId: number;
};

export const JigsawPiece = memo(function JigsawPiece({ geometry, imageDataUrl, layout, pieceId }: Props) {
  const tabSize = Math.min(layout.pieceWidth, layout.pieceHeight) * 0.22;
  const path = createPiecePath(layout.pieceWidth, layout.pieceHeight, geometry.edges, tabSize);

  return (
    <svg
      aria-hidden="true"
      className="piece-svg"
      style={{
        left: `${(-tabSize / layout.pieceWidth) * 100}%`,
        top: `${(-tabSize / layout.pieceHeight) * 100}%`,
        width: `${((layout.pieceWidth + tabSize * 2) / layout.pieceWidth) * 100}%`,
        height: `${((layout.pieceHeight + tabSize * 2) / layout.pieceHeight) * 100}%`,
      }}
      viewBox={`${-tabSize} ${-tabSize} ${layout.pieceWidth + tabSize * 2} ${layout.pieceHeight + tabSize * 2}`}
    >
      <defs>
        <clipPath id={`piece-clip-${pieceId}`}>
          <path d={path} />
        </clipPath>
      </defs>
      <g className="piece-shape" clipPath={`url(#piece-clip-${pieceId})`}>
        <image
          href={imageDataUrl}
          x={-geometry.sourceX}
          y={-geometry.sourceY}
          width={layout.boardWidth}
          height={layout.boardHeight}
          preserveAspectRatio="none"
        />
      </g>
      <path className="piece-edge" d={path} />
    </svg>
  );
});
