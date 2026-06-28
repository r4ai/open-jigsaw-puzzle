import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-jigsaw-puzzle/shared/protocol";
import { updatePieceById } from "../../utils/puzzle-ops";
import type { RemoteSelection } from "./types";

/** A pure transformation of the current piece array. */
export type PieceTransform = (current: BoardPiece[]) => BoardPiece[];

/**
 * A side effect requested by {@link reduceMessage}. The realtime-sync runner
 * interprets these against the live hook state, keeping the reducer pure.
 */
export type SyncCommand =
  | { kind: "bumpRemoteVersion" }
  | { kind: "notifyMoved"; by: string }
  | { kind: "notifyLocked"; by: string }
  | { kind: "transformPieces"; transform: PieceTransform }
  | { kind: "applySynced"; pieces: SyncedPiece[] }
  | { kind: "setStartedAtMs"; startedAtMs: number }
  | { kind: "upsertRemoteSelection"; selection: RemoteSelection }
  | { kind: "markCleared"; elapsedMs: number };

export type ReducerContext = {
  /** The local participant id, or null before the room handshake completes. */
  myId: string | null;
  /** Clamps a piece position to the valid canvas range. */
  constrain: (pieceId: number, x: number, y: number) => { x: number; y: number };
};

/**
 * Translate an inbound {@link ChannelMessage} into an ordered list of
 * {@link SyncCommand}s. Pure: it neither mutates state nor performs effects, so
 * its output can be asserted directly in tests.
 *
 * Commands are emitted in the same order the legacy switch applied them
 * (version bump → participant notification → piece transform) so the observable
 * behaviour is unchanged.
 */
export function reduceMessage(msg: ChannelMessage, ctx: ReducerContext): SyncCommand[] {
  switch (msg.type) {
    case "piece-move": {
      const commands = remoteVersionBump(msg.by, ctx.myId);
      commands.push({ kind: "notifyMoved", by: msg.by });
      commands.push({
        kind: "transformPieces",
        transform: (current) =>
          updatePieceById(current, msg.pieceId, (piece) => {
            if (piece.locked) return piece;
            const { x, y } = ctx.constrain(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z };
          }),
      });
      return commands;
    }
    case "piece-moves": {
      const commands = remoteVersionBump(msg.by, ctx.myId);
      commands.push({ kind: "notifyMoved", by: msg.by });
      commands.push({
        kind: "transformPieces",
        transform: (current) => {
          const movesById = new Map(msg.moves.map((move) => [move.pieceId, move]));
          return current.map((piece) => {
            const move = movesById.get(piece.id);
            if (!move || piece.locked) return piece;
            const { x, y } = ctx.constrain(move.pieceId, move.x, move.y);
            return { ...piece, x, y, z: move.z };
          });
        },
      });
      return commands;
    }
    case "piece-lock": {
      const commands = remoteVersionBump(msg.by, ctx.myId);
      commands.push({ kind: "notifyLocked", by: msg.by });
      commands.push({
        kind: "transformPieces",
        transform: (current) =>
          updatePieceById(current, msg.pieceId, (piece) => {
            const { x, y } = ctx.constrain(msg.pieceId, msg.x, msg.y);
            return { ...piece, x, y, z: msg.z, locked: true };
          }),
      });
      return commands;
    }
    case "piece-locks": {
      const commands = remoteVersionBump(msg.by, ctx.myId);
      commands.push({ kind: "notifyLocked", by: msg.by });
      commands.push({
        kind: "transformPieces",
        transform: (current) => {
          const locksById = new Map(msg.locks.map((lock) => [lock.pieceId, lock]));
          return current.map((piece) => {
            const lock = locksById.get(piece.id);
            if (!lock) return piece;
            const { x, y } = ctx.constrain(lock.pieceId, lock.x, lock.y);
            return { ...piece, x, y, z: lock.z, locked: true };
          });
        },
      });
      return commands;
    }
    case "piece-front":
      return [
        ...remoteVersionBump(msg.by, ctx.myId),
        {
          kind: "transformPieces",
          transform: (current) =>
            updatePieceById(current, msg.pieceId, (piece) => ({ ...piece, z: msg.z })),
        },
      ];
    case "selection-presence":
      return [
        {
          kind: "upsertRemoteSelection",
          selection: {
            participantId: msg.participantId,
            pieceIds: msg.pieceIds,
            imageOverlaySelected: msg.imageOverlaySelected,
          },
        },
      ];
    case "state-sync": {
      const bumped = !msg.by || msg.by !== ctx.myId;
      const commands: SyncCommand[] = bumped ? [{ kind: "bumpRemoteVersion" }] : [];
      if (msg.startedAtMs != null) {
        commands.push({ kind: "setStartedAtMs", startedAtMs: msg.startedAtMs });
      }
      commands.push({ kind: "applySynced", pieces: msg.pieces });
      return commands;
    }
    case "puzzle-completed":
      return [{ kind: "markCleared", elapsedMs: msg.elapsedMs }];
    default:
      return [];
  }
}

function remoteVersionBump(by: string, myId: string | null): SyncCommand[] {
  return by !== myId ? [{ kind: "bumpRemoteVersion" }] : [];
}
