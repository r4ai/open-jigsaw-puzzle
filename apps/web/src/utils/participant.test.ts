import { describe, expect, it } from "vitest";
import { PARTICIPANT_COLORS, participantColor } from "./participant";

describe("participantColor", () => {
  it("returns a stable palette color for the same participant", () => {
    expect(participantColor("peer-1")).toBe(participantColor("peer-1"));
    expect(PARTICIPANT_COLORS).toContain(participantColor("peer-1"));
  });

  it("uses the full participant id instead of only the first character", () => {
    expect(participantColor("a")).not.toBe(participantColor("aa"));
  });
});
