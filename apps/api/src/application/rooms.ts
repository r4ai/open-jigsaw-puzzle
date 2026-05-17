import type { Difficulty, RoomSummary } from "@open-puzzle/shared/protocol";
import { createRoomId } from "@open-puzzle/shared/rooms";
import type { Clock } from "./clock";

export type StoredRoom = {
  id: string;
  difficulty: Difficulty;
  expiresAt: number;
  participantCount: number;
};

export type RoomRepository = {
  create: (id: string, difficulty: Difficulty, ttlSeconds: number) => Promise<StoredRoom | null>;
  read: (roomId: string) => Promise<StoredRoom | null>;
  touch: (roomId: string, participantCount: number, ttlSeconds: number) => Promise<StoredRoom>;
  deleteExpired: (expiredBefore: number, limit: number) => Promise<void>;
};

export type RoomEventRepository = {
  record: (roomId: string, eventType: string, payload: unknown) => Promise<void>;
};

export function roomSummary(row: StoredRoom): RoomSummary {
  return {
    id: row.id,
    difficulty: row.difficulty,
    expiresAt: row.expiresAt,
    participantCount: row.participantCount,
  };
}

export async function createRoom(
  rooms: RoomRepository,
  events: RoomEventRepository,
  difficulty: Difficulty,
  ttlSeconds: number,
  createId = createRoomId,
): Promise<RoomSummary | null> {
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const id = createId();
    let row: StoredRoom | null;
    try {
      row = await rooms.create(id, difficulty, ttlSeconds);
    } catch (error) {
      if (attempts === 3) throw error;
      continue;
    }
    if (!row) continue;
    await events.record(row.id, "create", { difficulty });
    return roomSummary(row);
  }
  return null;
}

export async function getRoom(rooms: RoomRepository, roomId: string, clock: Clock): Promise<"not-found" | "expired" | RoomSummary> {
  const row = await rooms.read(roomId);
  if (!row) return "not-found";
  if (clock() >= row.expiresAt) return "expired";
  return roomSummary(row);
}
