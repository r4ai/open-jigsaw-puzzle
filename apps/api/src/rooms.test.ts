import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, ROOM_TTL_SECONDS } from "@open-jigsaw-puzzle/shared/protocol";
import { assertCanJoin, expiresAt, parseDifficulty } from "@open-jigsaw-puzzle/shared/rooms";
import { getIceConfig } from "./application/ice";
import { deleteExpiredRooms } from "./application/maintenance";
import { createRoom } from "./application/rooms";
import type { RoomEventRepository, RoomRepository } from "./application/rooms";
import type { Env } from "./infrastructure/cloudflare/bindings";
import { createD1RoomRepository } from "./infrastructure/d1/rooms-repository";
import { createApp } from "./presentation/http/app";
import { isAllowedWebSocketOrigin } from "./presentation/realtime/puzzle-room";
import { readEnvPositiveInteger } from "./index";

describe("worker room constraints", () => {
  it("uses the approved difficulty set", () => {
    expect(parseDifficulty(48)).toBe(48);
    expect(parseDifficulty(96)).toBe(96);
    expect(parseDifficulty(192)).toBe(192);
    expect(parseDifficulty(24)).toBeNull();
  });

  it("keeps rooms alive for two hours after activity", () => {
    expect(expiresAt(1_000, ROOM_TTL_SECONDS)).toBe(8_200);
  });

  it("enforces participant limits and expiry", () => {
    expect(() => assertCanJoin(MAX_PARTICIPANTS - 1, 100, 200)).not.toThrow();
    expect(() => assertCanJoin(MAX_PARTICIPANTS, 100, 200)).toThrow("full");
    expect(() => assertCanJoin(0, 200, 200)).toThrow("expired");
  });

  it("falls back for invalid positive integer environment values", () => {
    expect(readEnvPositiveInteger("12", 6)).toBe(12);
    expect(readEnvPositiveInteger(undefined, 6)).toBe(6);
    expect(readEnvPositiveInteger("", 6)).toBe(6);
    expect(readEnvPositiveInteger("oops", 6)).toBe(6);
    expect(readEnvPositiveInteger("0", 6)).toBe(6);
    expect(readEnvPositiveInteger("1.5", 6)).toBe(6);
  });
});

describe("worker REST API contract", () => {
  it("rejects invalid room creation bodies with the existing error shape", async () => {
    const response = await createApp().request("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ difficulty: 24 }),
    }, fakeEnv());

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Difficulty must be 48, 96, or 192." });
  });

  it("rejects oversized room creation bodies", async () => {
    const response = await createApp().request("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ difficulty: 48, padding: "x".repeat(2_000) }),
    }, fakeEnv());

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Request body is too large." });
  });

  it("creates rooms and returns persisted metadata", async () => {
    const db = new FakeD1();
    const response = await createApp().request("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ difficulty: 96 }),
    }, fakeEnv({ open_jigsaw_puzzle: db as unknown as D1Database }));
    const payload = await response.json() as { room: { id: string; difficulty: number; participantCount: number } };

    expect(response.status).toBe(201);
    expect(payload.room.id).toHaveLength(10);
    expect(payload.room.difficulty).toBe(96);
    expect(payload.room.participantCount).toBe(0);
    expect(db.events).toHaveLength(1);
  });

  it("does not record creation events when room persistence returns no row", async () => {
    const events: Array<{ roomId: string; eventType: string; payload: unknown }> = [];
    const rooms: RoomRepository = {
      async create() {
        return null;
      },
      async read() {
        return null;
      },
      async touch() {
        throw new Error("Unexpected touch.");
      },
      async deleteExpired() {},
    };
    const eventRepository: RoomEventRepository = {
      async record(roomId, eventType, payload) {
        events.push({ roomId, eventType, payload });
      },
    };

    await expect(createRoom(rooms, eventRepository, 48, ROOM_TTL_SECONDS, () => "ABCDEFGHJK")).resolves.toBeNull();

    expect(events).toEqual([]);
  });

  it("retries room id collisions without duplicating successful room creation on event failures", async () => {
    const createdIds: string[] = [];
    const rooms: RoomRepository = {
      async create(id, difficulty) {
        createdIds.push(id);
        if (createdIds.length === 1) throw new Error("UNIQUE constraint failed: rooms.id");
        return { id, difficulty, expiresAt: 8_200, participantCount: 0 };
      },
      async read() {
        return null;
      },
      async touch() {
        throw new Error("Unexpected touch.");
      },
      async deleteExpired() {},
    };
    const eventRepository: RoomEventRepository = {
      async record() {
        throw new Error("event store unavailable");
      },
    };
    const ids = ["ABCDEFGHJK", "BCDEFGHJKL"];

    await expect(createRoom(rooms, eventRepository, 48, ROOM_TTL_SECONDS, () => ids.shift()!)).rejects.toThrow("event store unavailable");

    expect(createdIds).toEqual(["ABCDEFGHJK", "BCDEFGHJKL"]);
  });

  it("handles room lookup errors without changing response shapes", async () => {
    const db = new FakeD1();
    const missing = await createApp().request("/api/rooms/ABCDEFGHJK", {}, fakeEnv({ open_jigsaw_puzzle: db as unknown as D1Database }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Room not found." });

    db.rows.set("ABCDEFGHJK", { id: "ABCDEFGHJK", difficulty: 48, expires_at: 0, participant_count: 0 });
    const expired = await createApp().request("/api/rooms/ABCDEFGHJK", {}, fakeEnv({ open_jigsaw_puzzle: db as unknown as D1Database }));
    expect(expired.status).toBe(410);
    expect(await expired.json()).toEqual({ error: "Room has expired." });
  });

  it("rejects malformed room ids before database access", async () => {
    const response = await createApp().request("/api/rooms/not-a-room", {}, fakeEnv());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Room id is required." });
  });

  it("returns the OpenAPI document for REST paths only", async () => {
    const response = await createApp().request("/api/openapi.json", {}, fakeEnv());
    const spec = await response.json() as { paths: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(spec.paths["/api/rooms"]).toBeTruthy();
    expect(spec.paths["/api/rooms/{roomId}"]).toBeTruthy();
    expect(spec.paths["/api/ice"]).toBeTruthy();
    expect(spec.paths["/api/rooms/{roomId}/socket"]).toBeUndefined();
  });

  it("builds ICE config from optional TURN environment", () => {
    expect(getIceConfig(fakeEnv()).iceServers).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }]);
    expect(getIceConfig(fakeEnv({
      TURN_URLS: "turn:a.example, turn:b.example",
      TURN_USERNAME: "user",
      TURN_CREDENTIAL: "secret",
    })).iceServers).toEqual([
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: ["turn:a.example", "turn:b.example"], username: "user", credential: "secret" },
    ]);
  });

  it("rejects cross-origin websocket upgrades", () => {
    expect(isAllowedWebSocketOrigin(new Request("https://puzzle.example/api/rooms/ABCDEFGHJK/socket"))).toBe(true);
    expect(isAllowedWebSocketOrigin(new Request("https://puzzle.example/api/rooms/ABCDEFGHJK/socket", {
      headers: { origin: "https://puzzle.example" },
    }))).toBe(true);
    expect(isAllowedWebSocketOrigin(new Request("https://puzzle.example/api/rooms/ABCDEFGHJK/socket", {
      headers: { origin: "https://evil.example" },
    }))).toBe(false);
    expect(isAllowedWebSocketOrigin(new Request("https://puzzle.example/api/rooms/ABCDEFGHJK/socket", {
      headers: { origin: "not a url" },
    }))).toBe(false);
  });

  it("deletes expired rooms after the configured retention window", async () => {
    const calls: Array<{ expiredBefore: number; limit: number }> = [];
    const rooms: RoomRepository = {
      async create() {
        return null;
      },
      async read() {
        return null;
      },
      async touch() {
        throw new Error("Unexpected touch.");
      },
      async deleteExpired(expiredBefore, limit) {
        calls.push({ expiredBefore, limit });
      },
    };

    await deleteExpiredRooms(rooms, () => 1_000, 300, 25);

    expect(calls).toEqual([{ expiredBefore: 700, limit: 25 }]);
  });

  it("removes expired room metadata and matching event rows in one cleanup batch", async () => {
    const db = new FakeD1();
    db.rows.set("OLDROOM001", { id: "OLDROOM001", difficulty: 48, expires_at: 100, participant_count: 0 });
    db.rows.set("OLDROOM002", { id: "OLDROOM002", difficulty: 96, expires_at: 200, participant_count: 0 });
    db.rows.set("FRESHROOM1", { id: "FRESHROOM1", difficulty: 96, expires_at: 900, participant_count: 0 });
    db.events.push(["OLDROOM001", "create", 1, "{}"]);
    db.events.push(["FRESHROOM1", "create", 1, "{}"]);

    await createD1RoomRepository(db as unknown as D1Database, () => 1_000).deleteExpired(500, 1);

    expect([...db.rows.keys()].sort()).toEqual(["FRESHROOM1", "OLDROOM002"]);
    expect(db.events).toEqual([["FRESHROOM1", "create", 1, "{}"]]);
  });
});

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    open_jigsaw_puzzle: {} as D1Database,
    ROOMS: {} as DurableObjectNamespace,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) } as unknown as Fetcher,
    ...overrides,
  };
}

class FakeD1 {
  readonly rows = new Map<string, { id: string; difficulty: number; expires_at: number; participant_count: number }>();
  readonly events: unknown[][] = [];

  prepare(sql: string) {
    const db = this;
    return {
      bind(...values: unknown[]) {
        return {
          async run() {
            if (sql.startsWith("INSERT INTO rooms")) {
              const [id, difficulty, , expiresAt] = values as [string, number, number, number, number];
              db.rows.set(id, { id, difficulty, expires_at: expiresAt, participant_count: 0 });
            }
            if (sql.startsWith("INSERT INTO room_events")) db.events.push(values);
            if (sql.startsWith("DELETE FROM room_events")) {
              const expiredIds = db.expiredRoomIds(values[0] as number, values[1] as number);
              db.events.splice(0, db.events.length, ...db.events.filter((event) => !expiredIds.has(event[0] as string)));
            }
            if (sql.startsWith("DELETE FROM rooms")) {
              for (const id of db.expiredRoomIds(values[0] as number, values[1] as number)) db.rows.delete(id);
            }
            return {};
          },
          async first<T>() {
            if (sql.startsWith("SELECT")) return (db.rows.get(values[0] as string) ?? null) as T | null;
            return null;
          },
        };
      },
    };
  }

  private expiredRoomIds(expiredBefore: number, limit: number): Set<string> {
    return new Set(
      [...this.rows.values()]
        .filter((row) => row.expires_at < expiredBefore)
        .sort((a, b) => a.expires_at - b.expires_at)
        .slice(0, limit)
        .map((row) => row.id),
    );
  }
}
