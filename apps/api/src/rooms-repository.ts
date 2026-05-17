import { expiresAt } from "@open-puzzle/shared/rooms";
import type { Difficulty } from "@open-puzzle/shared/protocol";
import type { RoomRow } from "./types";
import type { Clock } from "./time";

export async function createRoomRow(db: D1Database, id: string, difficulty: Difficulty, ttlSeconds: number, clock: Clock): Promise<RoomRow | null> {
  const now = clock();
  await db
    .prepare("INSERT INTO rooms (id, difficulty, created_at, expires_at, participant_count, last_seen_at) VALUES (?, ?, ?, ?, 0, ?)")
    .bind(id, difficulty, now, expiresAt(now, ttlSeconds), now)
    .run();
  return readRoom(db, id);
}

export async function readRoom(db: D1Database, roomId: string): Promise<RoomRow | null> {
  return db
    .prepare("SELECT id, difficulty, expires_at, participant_count FROM rooms WHERE id = ?")
    .bind(roomId)
    .first<RoomRow>();
}

export async function touchRoom(db: D1Database, roomId: string, participantCount: number, ttlSeconds: number, clock: Clock): Promise<RoomRow> {
  const now = clock();
  const row = await db
    .prepare(
      "UPDATE rooms SET participant_count = ?, last_seen_at = ?, expires_at = ? WHERE id = ? RETURNING id, difficulty, expires_at, participant_count",
    )
    .bind(participantCount, now, expiresAt(now, ttlSeconds), roomId)
    .first<RoomRow>();
  if (!row) throw new Error("Room disappeared.");
  return row;
}

export async function recordEvent(db: D1Database, roomId: string, eventType: string, payload: unknown, clock: Clock): Promise<void> {
  await db
    .prepare("INSERT INTO room_events (room_id, event_type, created_at, payload) VALUES (?, ?, ?, ?)")
    .bind(roomId, eventType, clock(), JSON.stringify(payload))
    .run();
}
