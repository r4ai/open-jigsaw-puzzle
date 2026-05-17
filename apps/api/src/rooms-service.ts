import { ROOM_TTL_SECONDS, type Difficulty, type RoomSummary } from "@open-puzzle/shared/protocol";
import { createRoomId } from "@open-puzzle/shared/rooms";
import { readEnvPositiveInteger } from "./env";
import { createRoomRow, readRoom, recordEvent } from "./rooms-repository";
import type { Clock } from "./time";
import type { Env, RoomRow } from "./types";

export function roomSummary(row: RoomRow): RoomSummary {
  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    expiresAt: row.expires_at,
    participantCount: row.participant_count,
  };
}

export async function createRoom(env: Env, difficulty: Difficulty, clock: Clock): Promise<RoomSummary | null> {
  const ttl = readEnvPositiveInteger(env.ROOM_TTL_SECONDS, ROOM_TTL_SECONDS);
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const id = createRoomId();
    try {
      const row = await createRoomRow(env.DB, id, difficulty, ttl, clock);
      await recordEvent(env.DB, id, "create", { difficulty }, clock);
      if (!row) return null;
      return roomSummary(row);
    } catch (error) {
      if (attempts === 3) throw error;
    }
  }
  return null;
}

export async function getRoom(env: Env, roomId: string, clock: Clock): Promise<"not-found" | "expired" | RoomSummary> {
  const row = await readRoom(env.DB, roomId);
  if (!row) return "not-found";
  if (clock() >= row.expires_at) return "expired";
  return roomSummary(row);
}
