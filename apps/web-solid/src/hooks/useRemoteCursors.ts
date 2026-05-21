import { createSignal, onCleanup } from "solid-js";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";

export type RemoteCursor = {
  participantId: string;
  name: string;
  x: number;
  y: number;
  seenAt: number;
};

const CURSOR_THROTTLE_MS = 40;
const CURSOR_ACTIVE_TTL_MS = 120;

type Props = {
  myId: () => string | null;
  name: () => string;
  broadcast: (msg: ChannelMessage) => void;
};

export function useRemoteCursors({ myId, name, broadcast }: Props) {
  const [remoteCursors, setRemoteCursors] = createSignal<RemoteCursor[]>([]);
  const [activeRemoteCursorIds, setActiveRemoteCursorIds] = createSignal<Set<string>>(new Set());

  let lastSent = 0;
  const activityTimers = new Map<string, number>();

  onCleanup(() => {
    for (const timer of activityTimers.values()) window.clearTimeout(timer);
    activityTimers.clear();
  });

  function markActive(participantId: string) {
    if (participantId === myId()) return;
    const existing = activityTimers.get(participantId);
    if (existing !== undefined) window.clearTimeout(existing);
    setActiveRemoteCursorIds((cur) => {
      if (cur.has(participantId)) return cur;
      const next = new Set<string>(cur);
      next.add(participantId);
      return next;
    });
    const timer = window.setTimeout(() => clearActive(participantId), CURSOR_ACTIVE_TTL_MS);
    activityTimers.set(participantId, timer);
  }

  function clearActive(participantId: string) {
    const existing = activityTimers.get(participantId);
    if (existing !== undefined) window.clearTimeout(existing);
    activityTimers.delete(participantId);
    setActiveRemoteCursorIds((cur) => {
      if (!cur.has(participantId)) return cur;
      const next = new Set<string>(cur);
      next.delete(participantId);
      return next;
    });
  }

  function clearAll() {
    for (const timer of activityTimers.values()) window.clearTimeout(timer);
    activityTimers.clear();
    setActiveRemoteCursorIds(new Set<string>());
    setRemoteCursors([]);
  }

  function removeCursor(participantId: string) {
    clearActive(participantId);
    setRemoteCursors((cur) => cur.filter((c) => c.participantId !== participantId));
  }

  function publishCursor(cursor: { x: number; y: number } | null, force = false) {
    const id = myId();
    if (!id) return;
    const now = Date.now();
    if (!force && now - lastSent < CURSOR_THROTTLE_MS) return;
    lastSent = now;
    broadcast({ type: "presence", participantId: id, name: name(), cursor });
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    if (msg.type !== "presence") return;
    setRemoteCursors((cur) => {
      if (!msg.cursor) {
        clearActive(msg.participantId);
        return cur.filter((c) => c.participantId !== msg.participantId);
      }
      const next: RemoteCursor = {
        participantId: msg.participantId,
        name: msg.name,
        x: msg.cursor.x,
        y: msg.cursor.y,
        seenAt: Date.now(),
      };
      const exists = cur.some((c) => c.participantId === msg.participantId);
      return exists
        ? cur.map((c) => (c.participantId === msg.participantId ? next : c))
        : [...cur, next];
    });
  }

  function updateCursorName(participantId: string, nextName: string) {
    setRemoteCursors((cur) =>
      cur.map((c) => (c.participantId === participantId ? { ...c, name: nextName } : c)),
    );
  }

  return {
    remoteCursors,
    activeRemoteCursorIds,
    publishCursor,
    markActive,
    clearActive,
    clearAll,
    removeCursor,
    updateCursorName,
    handleMessage,
  };
}
