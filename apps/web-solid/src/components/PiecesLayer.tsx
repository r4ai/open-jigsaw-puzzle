import { For } from "solid-js";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import { JigsawPiece } from "./JigsawPiece";
import { piece as pieceCls, pieceLocked } from "./PuzzleBoard.styles";

type Props = {
  pieces: BoardPiece[];
  layout: PuzzleLayout;
  imageDataUrl: string;
  margin: number;
  selectedPieceIds: Set<number>;
  myColor: string | null;
  remotePieceColors: Map<number, string>;
  onPiecePointerDown: (e: PointerEvent, piece: BoardPiece) => void;
  registerPieceElement: (id: number, el: HTMLElement | null) => void;
};

export function PiecesLayer(props: Props) {
  return (
    <For each={props.pieces}>
      {(piece) => {
        const geometry = props.layout.pieces[piece.id];
        const remoteColor = () => props.remotePieceColors.get(piece.id) ?? null;
        const selected = () => props.selectedPieceIds.has(piece.id);
        return (
          <button
            ref={(el) => props.registerPieceElement(piece.id, el)}
            class={`${pieceCls} ${piece.locked ? pieceLocked : ""}`}
            style={{
              transform: `translate3d(${props.margin + piece.x}px, ${props.margin + piece.y}px, 0)`,
              width: `${props.layout.pieceWidth}px`,
              height: `${props.layout.pieceHeight}px`,
              "z-index": piece.z,
            }}
            aria-label={`piece ${piece.id + 1}`}
            onPointerDown={(e) => props.onPiecePointerDown(e, piece)}
          >
            <JigsawPiece
              geometry={geometry}
              imageDataUrl={props.imageDataUrl}
              layout={props.layout}
              pieceId={piece.id}
              locked={piece.locked}
              selected={selected()}
              selectionColor={props.myColor}
              remoteColor={remoteColor()}
            />
          </button>
        );
      }}
    </For>
  );
}
