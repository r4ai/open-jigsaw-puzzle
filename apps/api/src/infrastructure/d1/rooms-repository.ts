import type { Difficulty } from "@open-jigsaw-puzzle/shared/protocol";
import { expiresAt } from "@open-jigsaw-puzzle/shared/rooms";
import type { RoomEventRepository, RoomRepository, StoredRoom } from "../../application/rooms";
import type { Clock } from "../../application/clock";

type RoomRow = {
  id: string;
  difficulty: number;
  expires_at: number;
  participant_count: number;
};

export function createD1RoomRepository(db: D1Database, clock: Clock): RoomRepository {
  return {
    async create(id, difficulty, ttlSeconds) {
      const now = clock();
      await db
        .prepare("INSERT INTO rooms (id, difficulty, created_at, expires_at, participant_count, last_seen_at) VALUES (?, ?, ?, ?, 0, ?)")
        .bind(id, difficulty, now, expiresAt(now, ttlSeconds), now)
        .run();
      return this.read(id);
    },
    async read(roomId) {
      const row = await db
        .prepare("SELECT id, difficulty, expires_at, participant_count FROM rooms WHERE id = ?")
        .bind(roomId)
        .first<RoomRow>();
      return row ? toStoredRoom(row) : null;
    },
    async touch(roomId, participantCount, ttlSeconds) {
      const now = clock();
      const row = await db
        .prepare(
          "UPDATE rooms SET participant_count = ?, last_seen_at = ?, expires_at = ? WHERE id = ? RETURNING id, difficulty, expires_at, participant_count",
        )
        .bind(participantCount, now, expiresAt(now, ttlSeconds), roomId)
        .first<RoomRow>();
      if (!row) throw new Error("Room disappeared.");
      return toStoredRoom(row);
    },
    async deleteExpired(expiredBefore, limit) {
      const safeLimit = Math.max(1, Math.trunc(limit));
      await db
        .prepare(
          [
            "DELETE FROM room_events",
            "WHERE room_id IN (",
            "  SELECT id FROM rooms WHERE expires_at < ? ORDER BY expires_at LIMIT ?",
            ")",
          ].join(" "),
        )
        .bind(expiredBefore, safeLimit)
        .run();
      await db
        .prepare("DELETE FROM rooms WHERE id IN (SELECT id FROM rooms WHERE expires_at < ? ORDER BY expires_at LIMIT ?)")
        .bind(expiredBefore, safeLimit)
        .run();
    },
  };
}

export function createD1RoomEventRepository(db: D1Database, clock: Clock): RoomEventRepository {
  return {
    async record(roomId, eventType, payload) {
      await db
        .prepare("INSERT INTO room_events (room_id, event_type, created_at, payload) VALUES (?, ?, ?, ?)")
        .bind(roomId, eventType, clock(), JSON.stringify(payload))
        .run();
    },
  };
}

function toStoredRoom(row: RoomRow): StoredRoom {
  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    expiresAt: row.expires_at,
    participantCount: row.participant_count,
  };
}
