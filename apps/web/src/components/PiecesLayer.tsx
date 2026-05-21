import { memo, useCallback } from "react";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import { JigsawPiece } from "./JigsawPiece";
import styles from "./PuzzleBoard.module.css";

type PuzzlePieceViewProps = {
  piece: BoardPiece;
  geometry: PuzzleLayout["pieces"][number];
  imageDataUrl: string;
  layout: PuzzleLayout;
  margin: number;
  selected: boolean;
  selectionColor: string | null;
  remoteColor: string | null;
  onPointerDown: (e: React.PointerEvent, piece: BoardPiece) => void;
  registerElement: (id: number, el: HTMLElement | null) => void;
};

const PuzzlePieceView = memo(function PuzzlePieceView({
  piece,
  geometry,
  imageDataUrl,
  layout,
  margin,
  selected,
  selectionColor,
  remoteColor,
  onPointerDown,
  registerElement,
}: PuzzlePieceViewProps) {
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    onPointerDown(e, piece);
  }, [onPointerDown, piece]);

  const pieceId = piece.id;
  const handleRef = useCallback((el: HTMLButtonElement | null) => {
    registerElement(pieceId, el);
  }, [pieceId, registerElement]);

  return (
    <button
      ref={handleRef}
      className={`${styles.piece} ${piece.locked ? styles.locked : ""}`}
      style={{
        transform: `translate3d(${margin + piece.x}px, ${margin + piece.y}px, 0)`,
        width: `${layout.pieceWidth}px`,
        height: `${layout.pieceHeight}px`,
        zIndex: piece.z,
      } as React.CSSProperties}
      aria-label={`piece ${piece.id + 1}`}
      onPointerDown={handlePointerDown}
    >
      <JigsawPiece
        geometry={geometry}
        imageDataUrl={imageDataUrl}
        layout={layout}
        pieceId={piece.id}
        locked={piece.locked}
        selected={selected}
        selectionColor={selectionColor}
        remoteColor={remoteColor}
      />
    </button>
  );
}, arePuzzlePieceViewPropsEqual);

function arePuzzlePieceViewPropsEqual(prev: PuzzlePieceViewProps, next: PuzzlePieceViewProps): boolean {
  return (
    prev.piece === next.piece &&
    prev.geometry === next.geometry &&
    prev.imageDataUrl === next.imageDataUrl &&
    prev.layout === next.layout &&
    prev.margin === next.margin &&
    prev.selected === next.selected &&
    prev.selectionColor === next.selectionColor &&
    prev.remoteColor === next.remoteColor &&
    prev.onPointerDown === next.onPointerDown &&
    prev.registerElement === next.registerElement
  );
}

type Props = {
  pieces: BoardPiece[];
  layout: PuzzleLayout;
  imageDataUrl: string;
  margin: number;
  selectedPieceIds: Set<number>;
  myColor: string | null;
  remotePieceColors: Map<number, string>;
  onPiecePointerDown: (e: React.PointerEvent, piece: BoardPiece) => void;
  registerPieceElement: (id: number, el: HTMLElement | null) => void;
};

export const PiecesLayer = memo(function PiecesLayer({
  pieces,
  layout,
  imageDataUrl,
  margin,
  selectedPieceIds,
  myColor,
  remotePieceColors,
  onPiecePointerDown,
  registerPieceElement,
}: Props) {
  return (
    <>
      {pieces.map((piece) => {
        const geometry = layout.pieces[piece.id];
        const remoteColor = remotePieceColors.get(piece.id) ?? null;
        return (
          <PuzzlePieceView
            key={piece.id}
            piece={piece}
            geometry={geometry}
            imageDataUrl={imageDataUrl}
            layout={layout}
            margin={margin}
            selected={selectedPieceIds.has(piece.id)}
            selectionColor={myColor}
            remoteColor={remoteColor}
            onPointerDown={onPiecePointerDown}
            registerElement={registerPieceElement}
          />
        );
      })}
    </>
  );
});
