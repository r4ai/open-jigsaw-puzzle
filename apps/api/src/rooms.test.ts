import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, ROOM_TTL_SECONDS } from "@open-puzzle/shared/protocol";
import { assertCanJoin, expiresAt, parseDifficulty } from "@open-puzzle/shared/rooms";
import { getIceConfig } from "./application/ice";
import type { Env } from "./infrastructure/cloudflare/bindings";
import { createApp } from "./presentation/http/app";
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
    }, fakeEnv({ DB: db as unknown as D1Database }));
    const payload = await response.json() as { room: { id: string; difficulty: number; participantCount: number } };

    expect(response.status).toBe(201);
    expect(payload.room.id).toHaveLength(10);
    expect(payload.room.difficulty).toBe(96);
    expect(payload.room.participantCount).toBe(0);
    expect(db.events).toHaveLength(1);
  });

  it("handles room lookup errors without changing response shapes", async () => {
    const db = new FakeD1();
    const missing = await createApp().request("/api/rooms/ABCDEFGHJK", {}, fakeEnv({ DB: db as unknown as D1Database }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Room not found." });

    db.rows.set("ABCDEFGHJK", { id: "ABCDEFGHJK", difficulty: 48, expires_at: 0, participant_count: 0 });
    const expired = await createApp().request("/api/rooms/ABCDEFGHJK", {}, fakeEnv({ DB: db as unknown as D1Database }));
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
});

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ROOMS: {} as DurableObjectNamespace,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) } as unknown as Fetcher,
    ...overrides,
  };
}

class FakeD1 {
  readonly rows = new Map<string, { id: string; difficulty: number; expires_at: number; participant_count: number }>();
  readonly events: unknown[] = [];

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
}
