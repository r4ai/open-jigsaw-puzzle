import { Show, createMemo } from "solid-js";
import type { PieceGeometry, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import { createPiecePath } from "../utils/piece-path";
import {
  pieceEdge,
  pieceEdgeLocked,
  pieceShape,
  pieceShapeLocked,
  pieceSvg,
  remoteSelectionGlow,
  remoteSelectionStroke,
  selectionGlow,
  selectionStroke,
} from "./JigsawPiece.styles";

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

export function JigsawPiece(props: Props) {
  const tabSize = () => props.layout.tabSize;
  const path = createMemo(() =>
    createPiecePath(props.layout.pieceWidth, props.layout.pieceHeight, props.geometry, tabSize()),
  );

  return (
    <svg
      aria-hidden="true"
      class={pieceSvg}
      style={{
        left: `${(-tabSize() / props.layout.pieceWidth) * 100}%`,
        top: `${(-tabSize() / props.layout.pieceHeight) * 100}%`,
        width: `${((props.layout.pieceWidth + tabSize() * 2) / props.layout.pieceWidth) * 100}%`,
        height: `${((props.layout.pieceHeight + tabSize() * 2) / props.layout.pieceHeight) * 100}%`,
        "--selection-color": props.selectionColor ?? "transparent",
        "--remote-color": props.remoteColor ?? "transparent",
      }}
      viewBox={`${-tabSize()} ${-tabSize()} ${props.layout.pieceWidth + tabSize() * 2} ${props.layout.pieceHeight + tabSize() * 2}`}
    >
      <defs>
        <clipPath id={`piece-clip-${props.pieceId}`}>
          <path d={path()} />
        </clipPath>
      </defs>
      <g
        class={props.locked ? pieceShapeLocked : pieceShape}
        clip-path={`url(#piece-clip-${props.pieceId})`}
      >
        <image
          href={props.imageDataUrl}
          x={-props.geometry.sourceX}
          y={-props.geometry.sourceY}
          width={props.layout.boardWidth}
          height={props.layout.boardHeight}
          preserveAspectRatio="none"
        />
      </g>
      <Show when={props.remoteColor}>
        <path class={remoteSelectionGlow} d={path()} />
        <path class={remoteSelectionStroke} d={path()} />
      </Show>
      <Show when={props.selected}>
        <path class={selectionGlow} d={path()} />
        <path class={selectionStroke} d={path()} />
      </Show>
      <path class={`${pieceEdge} ${props.locked ? pieceEdgeLocked : ""}`} d={path()} />
    </svg>
  );
}
