import { describe, expect, it } from "vitest";
import { MAX_CHANNEL_MESSAGE_BYTES, parseChannelMessage, parseClientSignalMessage, parseSignalEnvelope } from "./protocol";

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
    expect(parseChannelMessage({ type: "state-sync", pieces: Array.from({ length: 2001 }, (_, id) => ({ id, x: 0, y: 0, z: 0, locked: false })), lockedCount: 0 })).toBeNull();
  });

  it("accepts state sync senders when present", () => {
    expect(parseChannelMessage({
      type: "state-sync",
      pieces: [{ id: 0, x: 0, y: 0, z: 0, locked: false }],
      lockedCount: 0,
      by: "peer-1",
    })).toMatchObject({ type: "state-sync", by: "peer-1" });
  });

  it("rejects invalid participant spoofing fields before app-level authorization", () => {
    expect(parseChannelMessage({ type: "presence", participantId: "", name: "Ada", cursor: null })).toBeNull();
    expect(parseChannelMessage({ type: "piece-lock", pieceId: 1, x: 0, y: 0, z: 1, by: "" })).toBeNull();
  });

  it("accepts selection presence messages", () => {
    expect(parseChannelMessage({
      type: "selection-presence",
      participantId: "peer-1",
      pieceIds: [0, 2, 191],
      imageOverlaySelected: true,
    })).toEqual({
      type: "selection-presence",
      participantId: "peer-1",
      pieceIds: [0, 2, 191],
      imageOverlaySelected: true,
    });
  });

  it("rejects malformed selection presence messages", () => {
    expect(parseChannelMessage({ type: "selection-presence", participantId: "", pieceIds: [1], imageOverlaySelected: false })).toBeNull();
    expect(parseChannelMessage({ type: "selection-presence", participantId: "peer-1", pieceIds: [1, 1], imageOverlaySelected: false })).toBeNull();
    expect(parseChannelMessage({ type: "selection-presence", participantId: "peer-1", pieceIds: [2000], imageOverlaySelected: false })).toBeNull();
    expect(parseChannelMessage({ type: "selection-presence", participantId: "peer-1", pieceIds: Array.from({ length: 2001 }, (_, id) => id), imageOverlaySelected: false })).toBeNull();
  });
});

describe("signaling message validation", () => {
  it("accepts valid server and client signaling messages", () => {
    expect(parseSignalEnvelope({
      type: "signal",
      from: "peer-1",
      to: "peer-2",
      payload: { type: "offer", description: { type: "offer", sdp: "v=0" } },
    })).toEqual({
      type: "signal",
      from: "peer-1",
      to: "peer-2",
      payload: { type: "offer", description: { type: "offer", sdp: "v=0" } },
    });
    expect(parseClientSignalMessage({
      type: "signal",
      to: "peer-2",
      payload: { type: "ice", candidate: { candidate: "candidate" } },
    })).toEqual({
      type: "signal",
      to: "peer-2",
      payload: { type: "ice", candidate: { candidate: "candidate" } },
    });
  });

  it("rejects malformed peer signals", () => {
    expect(parseSignalEnvelope({
      type: "signal",
      from: "peer-1",
      to: "peer-2",
      payload: { type: "offer", description: { type: "answer", sdp: "v=0" } },
    })).toBeNull();
    expect(parseClientSignalMessage({
      type: "signal",
      to: "peer-2",
      payload: { type: "ice", candidate: { candidate: "x".repeat(4097) } },
    })).toBeNull();
  });
});
