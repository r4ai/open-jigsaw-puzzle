import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-jigsaw-puzzle/shared/protocol";
import { reduceMessage, type SyncCommand } from "./message-reducer";
import type { RemoteSelection } from "./types";

type Deps = {
  myId: () => string | null;
  constrainPosition: (pieceId: number, x: number, y: number) => { x: number; y: number };
  updatePieces: (updater: (current: BoardPiece[]) => BoardPiece[]) => void;
  applySyncedPieces: (synced: SyncedPiece[]) => void;
  bumpRemoteVersion: () => void;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
  setStartedAtMsIfUnset: (ms: number) => void;
  markCleared: (elapsedMs: number) => void;
  upsertRemoteSelection: (selection: RemoteSelection) => void;
};

/**
 * The realtime message dispatcher: turns an inbound {@link ChannelMessage} into
 * {@link SyncCommand}s via the pure reducer, then applies each command against
 * the injected sub-hook commands. This is the single bridge between peer
 * messages and local state.
 */
export function createRealtimeSync(deps: Deps) {
  function run(command: SyncCommand) {
    switch (command.kind) {
      case "bumpRemoteVersion":
        deps.bumpRemoteVersion();
        break;
      case "notifyMoved":
        deps.onPieceMoved?.(command.by);
        break;
      case "notifyLocked":
        deps.onPieceLocked?.(command.by);
        break;
      case "transformPieces":
        deps.updatePieces(command.transform);
        break;
      case "applySynced":
        deps.applySyncedPieces(command.pieces);
        break;
      case "setStartedAtMs":
        deps.setStartedAtMsIfUnset(command.startedAtMs);
        break;
      case "upsertRemoteSelection":
        deps.upsertRemoteSelection(command.selection);
        break;
      case "markCleared":
        deps.markCleared(command.elapsedMs);
        break;
    }
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    const commands = reduceMessage(msg, { myId: deps.myId(), constrain: deps.constrainPosition });
    for (const command of commands) run(command);
  }

  return { handleMessage };
}
