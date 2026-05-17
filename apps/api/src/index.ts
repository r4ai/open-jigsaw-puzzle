export { createApp } from "./presentation/http/app";
export { readEnvPositiveInteger } from "./infrastructure/cloudflare/env";
export { PuzzleRoom } from "./presentation/realtime/puzzle-room";

import { CLEANUP_BATCH_SIZE, deleteExpiredRooms, EXPIRED_ROOM_RETENTION_SECONDS } from "./application/maintenance";
import { createApp } from "./presentation/http/app";
import { readEnvPositiveInteger as readPositiveIntegerEnv } from "./infrastructure/cloudflare/env";
import { createD1RoomRepository } from "./infrastructure/d1/rooms-repository";
import { systemClock } from "./infrastructure/time/clock";
import type { Env } from "./infrastructure/cloudflare/bindings";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      deleteExpiredRooms(
        createD1RoomRepository(env.open_jigsaw_puzzle, systemClock),
        systemClock,
        readPositiveIntegerEnv(env.EXPIRED_ROOM_RETENTION_SECONDS, EXPIRED_ROOM_RETENTION_SECONDS),
        readPositiveIntegerEnv(env.CLEANUP_BATCH_SIZE, CLEANUP_BATCH_SIZE),
      ),
    );
  },
};
