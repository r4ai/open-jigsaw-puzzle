import { describe, expect, it } from "vitest";
import { MAX_CHANNEL_MESSAGE_BYTES, parseChannelMessage } from "./protocol";

describe("channel message validation", () => {
  it("accepts well-formed messages", () => {
    expect(parseChannelMessage({ type: "piece-move", pieceId: 1, x: 10, y: 20, z: 3, by: "peer-1" })).toEqual({
      type: "piece-move",
      pieceId: 1,
      x: 10,
      y: 20,
      z: 3,
      by: "peer-1",
    });
  });

  it("rejects malformed image and sync payloads", () => {
    expect(parseChannelMessage({ type: "image-meta", imageId: "image-1", mimeType: "image/svg+xml", width: 640, height: 480, chunks: 1, byteLength: 10 })).toBeNull();
    expect(parseChannelMessage({ type: "image-chunk", imageId: "image-1", index: 0, data: "x".repeat(MAX_CHANNEL_MESSAGE_BYTES) })).toBeNull();
    expect(parseChannelMessage({ type: "state-sync", pieces: Array.from({ length: 193 }, (_, id) => ({ id, x: 0, y: 0, z: 0, locked: false })), lockedCount: 0 })).toBeNull();
  });

  it("rejects invalid participant spoofing fields before app-level authorization", () => {
    expect(parseChannelMessage({ type: "presence", participantId: "", name: "Ada", cursor: null })).toBeNull();
    expect(parseChannelMessage({ type: "piece-lock", pieceId: 1, x: 0, y: 0, z: 1, by: "" })).toBeNull();
  });
});
