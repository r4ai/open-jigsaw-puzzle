import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describeRoute, openAPIRouteHandler, validator } from "hono-openapi";
import { CreateRoomRequestSchema, RoomIdParamsSchema } from "@open-puzzle/shared/protocol";
import { normalizeRoomId } from "@open-puzzle/shared/rooms";
import { serveAssetOrSpa } from "./assets";
import { MAX_CREATE_ROOM_BODY_BYTES, MAX_CREATE_ROOM_REQUESTS_PER_MINUTE, SECURITY_HEADERS } from "./constants";
import { getIceConfig } from "./ice";
import { ERROR_RESPONSES, ICE_RESPONSE_CONTENT, OPENAPI_DOCUMENTATION, ROOM_RESPONSE_CONTENT } from "./openapi";
import { getClientKey, consumeRateLimit } from "./rate-limit";
import { createRoom, getRoom } from "./rooms-service";
import { systemClock } from "./time";
import type { Env, RateBucket } from "./types";

const createRoomRateLimits = new Map<string, RateBucket>();

export function createApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", async (c, next) => {
    await next();
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) c.header(header, value);
  });

  app.post(
    "/api/rooms",
    describeRoute({
      operationId: "createRoom",
      tags: ["Rooms"],
      summary: "Create a puzzle room",
      responses: {
        201: {
          description: "Created room",
          content: ROOM_RESPONSE_CONTENT,
        },
        ...ERROR_RESPONSES,
      },
    }),
    enforceCreateRoomLimits,
    validator("json", CreateRoomRequestSchema, (result, c) => {
      if (!result.success) return c.json({ error: "Difficulty must be 48, 96, or 192." }, 400);
    }),
    async (c) => {
      const body = c.req.valid("json");
      const room = await createRoom(c.env, body.difficulty, systemClock);
      if (!room) return c.json({ error: "Unable to create room." }, 500);
      return c.json({ room }, 201);
    },
  );

  app.get(
    "/api/rooms/:roomId",
    describeRoute({
      operationId: "getRoom",
      tags: ["Rooms"],
      summary: "Get room metadata",
      responses: {
        200: {
          description: "Room metadata",
          content: ROOM_RESPONSE_CONTENT,
        },
        ...ERROR_RESPONSES,
      },
    }),
    validator("param", RoomIdParamsSchema, (result, c) => {
      if (!result.success) return c.json({ error: "Room id is required." }, 400);
    }),
    async (c) => {
      const roomId = normalizeRoomId(c.req.valid("param").roomId);
      if (!roomId) return c.json({ error: "Room id is required." }, 400);
      const room = await getRoom(c.env, roomId, systemClock);
      if (room === "not-found") return c.json({ error: "Room not found." }, 404);
      if (room === "expired") return c.json({ error: "Room has expired." }, 410);
      return c.json({ room });
    },
  );

  app.get("/api/rooms/:roomId/socket", describeRoute({ hide: true }), (c) => {
    const roomId = normalizeRoomId(c.req.param("roomId"));
    if (!roomId) return c.json({ error: "Room id is required." }, 400);
    const id = c.env.ROOMS.idFromName(roomId);
    return c.env.ROOMS.get(id).fetch(c.req.raw);
  });

  app.get(
    "/api/ice",
    describeRoute({
      operationId: "getIceConfig",
      tags: ["Realtime"],
      summary: "Get WebRTC ICE server configuration",
      responses: {
        200: {
          description: "ICE server configuration",
          content: ICE_RESPONSE_CONTENT,
        },
      },
    }),
    (c) => c.json(getIceConfig(c.env)),
  );

  app.get(
    "/api/openapi.json",
    describeRoute({ hide: true }),
    openAPIRouteHandler(app, {
      documentation: OPENAPI_DOCUMENTATION,
      exclude: ["/api/openapi.json", "/api/rooms/{roomId}/socket"],
    }),
  );

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "Not found." }, 404);
    return serveAssetOrSpa(c.req.raw, c.env);
  });

  return app;
}

const enforceCreateRoomLimits: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!consumeRateLimit(createRoomRateLimits, getClientKey(c.req.raw), MAX_CREATE_ROOM_REQUESTS_PER_MINUTE)) {
    return c.json({ error: "Too many room creation requests." }, 429);
  }
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CREATE_ROOM_BODY_BYTES) {
    return c.json({ error: "Request body is too large." }, 413);
  }
  const text = await c.req.raw.clone().text();
  if (text.length > MAX_CREATE_ROOM_BODY_BYTES) return c.json({ error: "Request body is too large." }, 413);
  return next();
};
