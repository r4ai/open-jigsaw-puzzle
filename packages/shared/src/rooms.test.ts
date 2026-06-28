import { describe, expect, it } from "vitest";
import { assertCanJoin, createRoomId, expiresAt, normalizeRoomId, parseDifficulty, sanitizeName } from "./rooms";

describe("room rules", () => {
  it("validates difficulty", () => {
    expect(parseDifficulty(48)).toBe(48);
    expect(parseDifficulty("96")).toBe(96);
    expect(parseDifficulty(64)).toBeNull();
    expect(parseDifficulty("0x30")).toBeNull();
    expect(parseDifficulty("48e0")).toBeNull();
    expect(parseDifficulty("048")).toBeNull();
  });

  it("sanitizes display names", () => {
    expect(sanitizeName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
    expect(sanitizeName("")).toBe("Player");
  });

  it("creates opaque room ids", () => {
    const roomId = createRoomId((bytes) => bytes.fill(0));

    expect(roomId).toMatch(/^[A-Z2-9]{10}$/);
  });

  it("normalizes only generated room id shapes", () => {
    expect(normalizeRoomId(" abcdefghj2 ")).toBe("ABCDEFGHJ2");
    expect(normalizeRoomId("ABCDEF")).toBeNull();
    expect(normalizeRoomId("ABCDEFGHI1")).toBeNull();
    expect(normalizeRoomId("ABCDEF/GH2")).toBeNull();
  });

  it("applies a two hour TTL by default", () => {
    expect(expiresAt(100)).toBe(7300);
  });

  it("rejects full or expired rooms", () => {
    expect(() => assertCanJoin(5, 100, 200, 6)).not.toThrow();
    expect(() => assertCanJoin(6, 100, 200, 6)).toThrow("full");
    expect(() => assertCanJoin(1, 200, 200, 6)).toThrow("expired");
  });
});
