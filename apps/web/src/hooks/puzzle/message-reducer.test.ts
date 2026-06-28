import { describe, expect, it } from "vitest";
import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import { reduceMessage, type SyncCommand } from "./message-reducer";

const identityConstrain = (_id: number, x: number, y: number) => ({ x, y });

function piece(id: number, overrides: Partial<BoardPiece> = {}): BoardPiece {
  return { id, x: 0, y: 0, z: 0, locked: false, targetX: 0, targetY: 0, ...overrides };
}

function kinds(commands: SyncCommand[]): string[] {
  return commands.map((command) => command.kind);
}

function applyTransforms(commands: SyncCommand[], pieces: BoardPiece[]): BoardPiece[] {
  let next = pieces;
  for (const command of commands) {
    if (command.kind === "transformPieces") next = command.transform(next);
  }
  return next;
}

describe("reduceMessage", () => {
  it("bumps the remote version only for moves from another participant", () => {
    const fromOther = reduceMessage(
      { type: "piece-move", by: "peer", pieceId: 0, x: 1, y: 2, z: 3 },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(fromOther)).toEqual(["bumpRemoteVersion", "notifyMoved", "transformPieces"]);

    const fromSelf = reduceMessage(
      { type: "piece-move", by: "me", pieceId: 0, x: 1, y: 2, z: 3 },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(fromSelf)).toEqual(["notifyMoved", "transformPieces"]);
  });

  it("does not move a locked piece on piece-move", () => {
    const commands = reduceMessage(
      { type: "piece-move", by: "peer", pieceId: 0, x: 9, y: 9, z: 9 },
      { myId: "me", constrain: identityConstrain },
    );
    const result = applyTransforms(commands, [piece(0, { locked: true })]);
    expect(result[0]).toMatchObject({ x: 0, y: 0, z: 0, locked: true });
  });

  it("applies batched moves while skipping locked and unknown pieces", () => {
    const commands = reduceMessage(
      {
        type: "piece-moves",
        by: "peer",
        moves: [
          { pieceId: 0, x: 5, y: 6, z: 7 },
          { pieceId: 1, x: 8, y: 9, z: 10 },
        ],
      },
      { myId: "me", constrain: identityConstrain },
    );
    const result = applyTransforms(commands, [piece(0), piece(1, { locked: true })]);
    expect(result[0]).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(result[1]).toMatchObject({ x: 0, y: 0, locked: true });
  });

  it("locks pieces on piece-lock and piece-locks", () => {
    const single = reduceMessage(
      { type: "piece-lock", by: "peer", pieceId: 0, x: 1, y: 1, z: 2 },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(single)).toEqual(["bumpRemoteVersion", "notifyLocked", "transformPieces"]);
    expect(applyTransforms(single, [piece(0)])[0]).toMatchObject({ x: 1, y: 1, z: 2, locked: true });
  });

  it("updates only z on piece-front", () => {
    const commands = reduceMessage(
      { type: "piece-front", by: "peer", pieceId: 0, z: 42 },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(commands)).toEqual(["transformPieces"]);
    expect(applyTransforms(commands, [piece(0, { x: 3, y: 4 })])[0]).toMatchObject({ x: 3, y: 4, z: 42 });
  });

  it("maps selection-presence to an upsert command", () => {
    const commands = reduceMessage(
      { type: "selection-presence", participantId: "peer", pieceIds: [1, 2], imageOverlaySelected: true },
      { myId: "me", constrain: identityConstrain },
    );
    expect(commands).toEqual([
      {
        kind: "upsertRemoteSelection",
        selection: { participantId: "peer", pieceIds: [1, 2], imageOverlaySelected: true },
      },
    ]);
  });

  it("emits version bump, start time, then synced pieces for state-sync", () => {
    const commands = reduceMessage(
      {
        type: "state-sync",
        by: "peer",
        startedAtMs: 123,
        lockedCount: 0,
        pieces: [{ id: 0, x: 1, y: 2, z: 3, locked: false }],
      },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(commands)).toEqual(["bumpRemoteVersion", "setStartedAtMs", "applySynced"]);
  });

  it("bumps the version for a state-sync with no author", () => {
    const commands = reduceMessage(
      { type: "state-sync", by: "", lockedCount: 0, pieces: [] },
      { myId: "me", constrain: identityConstrain },
    );
    expect(kinds(commands)).toEqual(["bumpRemoteVersion", "applySynced"]);
  });

  it("maps puzzle-completed to a markCleared command", () => {
    const commands = reduceMessage(
      { type: "puzzle-completed", by: "peer", elapsedMs: 4_200 },
      { myId: "me", constrain: identityConstrain },
    );
    expect(commands).toEqual([{ kind: "markCleared", elapsedMs: 4_200 }]);
  });
});
