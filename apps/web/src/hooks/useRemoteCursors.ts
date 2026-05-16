import { useEffect, useRef, useState } from "react";
import type { ChannelMessage } from "@open-puzzle/shared/protocol";

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
  myId: string | null;
  name: string;
  broadcast: (msg: ChannelMessage) => void;
};

export function useRemoteCursors({ myId, name, broadcast }: Props) {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [activeRemoteCursorIds, setActiveRemoteCursorIds] = useState<Set<string>>(new Set());

  const myIdRef = useRef(myId);
  const nameRef = useRef(name);
  const broadcastRef = useRef(broadcast);
  const lastSentRef = useRef(0);
  const activityTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => { myIdRef.current = myId; }, [myId]);
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { broadcastRef.current = broadcast; }, [broadcast]);

  useEffect(() => {
    return () => {
      for (const timer of activityTimers.current.values()) window.clearTimeout(timer);
      activityTimers.current.clear();
    };
  }, []);

  function markActive(participantId: string) {
    if (participantId === myIdRef.current) return;
    const existing = activityTimers.current.get(participantId);
    if (existing !== undefined) window.clearTimeout(existing);
    setActiveRemoteCursorIds((cur) => {
      if (cur.has(participantId)) return cur;
      return new Set(cur).add(participantId);
    });
    const timer = window.setTimeout(() => clearActive(participantId), CURSOR_ACTIVE_TTL_MS);
    activityTimers.current.set(participantId, timer);
  }

  function clearActive(participantId: string) {
    const existing = activityTimers.current.get(participantId);
    if (existing !== undefined) window.clearTimeout(existing);
    activityTimers.current.delete(participantId);
    setActiveRemoteCursorIds((cur) => {
      if (!cur.has(participantId)) return cur;
      const next = new Set(cur);
      next.delete(participantId);
      return next;
    });
  }

  function clearAll() {
    for (const timer of activityTimers.current.values()) window.clearTimeout(timer);
    activityTimers.current.clear();
    setActiveRemoteCursorIds(new Set());
    setRemoteCursors([]);
  }

  function removeCursor(participantId: string) {
    clearActive(participantId);
    setRemoteCursors((cur) => cur.filter((c) => c.participantId !== participantId));
  }

  function publishCursor(cursor: { x: number; y: number } | null, force = false) {
    const id = myIdRef.current;
    if (!id) return;
    const now = Date.now();
    if (!force && now - lastSentRef.current < CURSOR_THROTTLE_MS) return;
    lastSentRef.current = now;
    broadcastRef.current({ type: "presence", participantId: id, name: nameRef.current, cursor });
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
