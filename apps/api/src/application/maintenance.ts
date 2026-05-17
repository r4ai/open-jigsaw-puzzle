import type { Clock } from "./clock";
import type { RoomRepository } from "./rooms";

export const EXPIRED_ROOM_RETENTION_SECONDS = 86_400;
export const CLEANUP_BATCH_SIZE = 500;

export async function deleteExpiredRooms(
  rooms: RoomRepository,
  clock: Clock,
  retentionSeconds: number,
  batchSize: number,
): Promise<void> {
  await rooms.deleteExpired(clock() - retentionSeconds, batchSize);
}
