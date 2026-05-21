import { describe, expect, it } from "vitest";
import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import { applyPieceSnapshots, createMoveHistoryEntry, createPieceHistory } from "./puzzle-history";

describe("piece move history", () => {
  it("undoes and redoes a remembered move", () => {
    const history = createPieceHistory();
    const before = [piece(0, 10, 20, 1, false)];
    const after = [{ ...before[0]!, x: 30, y: 40, z: 5 }];
    history.remember(createMoveHistoryEntry(before, after, 0));

    const undo = history.undo(0);
    expect(undo.result).toBe("applied");
    expect(applyPieceSnapshots(after, undo.snapshots)).toEqual(before);

    const redo = history.redo(0);
    expect(redo.result).toBe("applied");
    expect(applyPieceSnapshots(before, redo.snapshots)).toEqual(after);
  });

  it("blocks undo and redo after a later remote move", () => {
    const history = createPieceHistory();
    const before = [piece(0, 10, 20, 1, false)];
    const after = [{ ...before[0]!, x: 30 }];
    history.remember(createMoveHistoryEntry(before, after, 2));

    expect(history.undo(3).result).toBe("blocked");
    expect(history.undo(2).result).toBe("applied");
    expect(history.redo(3).result).toBe("blocked");
  });

  it("drops redo entries when a new move is remembered", () => {
    const history = createPieceHistory();
    const first = [piece(0, 0, 0, 1, false)];
    const second = [{ ...first[0]!, x: 10 }];
    const third = [{ ...first[0]!, x: 20 }];

    history.remember(createMoveHistoryEntry(first, second, 0));
    expect(history.undo(0).result).toBe("applied");
    history.remember(createMoveHistoryEntry(first, third, 0));

    expect(history.redo(0).result).toBe("empty");
  });

  it("does not remember unchanged moves", () => {
    expect(createMoveHistoryEntry([piece(0, 0, 0, 1, false)], [piece(0, 0, 0, 1, false)], 0)).toBeNull();
  });
});

function piece(id: number, x: number, y: number, z: number, locked: boolean): BoardPiece {
  return { id, targetX: 0, targetY: 0, x, y, z, locked };
}
