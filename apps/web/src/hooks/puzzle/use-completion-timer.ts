import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";
import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { countLockedPieces } from "../../utils/puzzle-ops";

type Deps = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  isHost: () => boolean;
  /** Reactive piece list; drives the completion/start effect. */
  pieces: Accessor<BoardPiece[]>;
  /** Reactive completion flag. */
  complete: Accessor<boolean>;
  /** Synchronous piece mirror; used to build the start-time state-sync payload. */
  getPieces: () => BoardPiece[];
};

/**
 * Owns the puzzle clock: the host-confirmed start time and the cleared elapsed
 * time. The host stamps the start time on first progress and the elapsed time
 * on completion, broadcasting both so every participant agrees on the result.
 */
export function useCompletionTimer(deps: Deps) {
  const [clearedElapsedMs, setClearedElapsedMs] = createSignal<number | null>(null);
  let startedAtMs: number | null = null;
  let clearedElapsedMsNow: number | null = null;

  const getStartedAtMs = () => startedAtMs;

  /** Adopt a peer's start time, but never overwrite one already known. */
  function setStartedAtMsIfUnset(ms: number) {
    if (startedAtMs === null) startedAtMs = ms;
  }

  /** Record the first observed completion time; later reports are ignored. */
  function markCleared(elapsedMs: number) {
    if (clearedElapsedMsNow !== null) return;
    clearedElapsedMsNow = elapsedMs;
    setClearedElapsedMs(elapsedMs);
  }

  function resetTimer() {
    startedAtMs = null;
    clearedElapsedMsNow = null;
    setClearedElapsedMs(null);
  }

  // 完成判定／開始計時 — ホストのみが時刻を確定する
  createEffect(() => {
    const list = deps.pieces();
    const done = deps.complete();
    if (list.length === 0) return;
    if (done) {
      if (!deps.isHost()) return;
      if (clearedElapsedMsNow !== null) return;
      if (startedAtMs === null) return;
      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      clearedElapsedMsNow = elapsedMs;
      setClearedElapsedMs(elapsedMs);
      deps.broadcast({ type: "puzzle-completed", elapsedMs, by: deps.myId() ?? "local" });
      return;
    }
    if (!deps.isHost()) return;
    if (startedAtMs !== null) return;
    startedAtMs = Date.now();
    const synced = deps.getPieces().map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    deps.broadcast({
      type: "state-sync",
      pieces: synced,
      lockedCount: countLockedPieces(synced),
      by: deps.myId() ?? "local",
      startedAtMs,
    });
  });

  return { clearedElapsedMs, getStartedAtMs, setStartedAtMsIfUnset, markCleared, resetTimer };
}
