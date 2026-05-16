import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, ROOM_TTL_SECONDS } from "@open-puzzle/shared/protocol";
import { assertCanJoin, expiresAt, parseDifficulty } from "@open-puzzle/shared/rooms";

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
});
