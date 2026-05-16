import { describe, expect, it } from "vitest";
import type { ChannelMessage } from "@open-puzzle/shared/protocol";
import { isAuthorizedPeerMessage } from "./WorkspacePage";

describe("isAuthorizedPeerMessage", () => {
  it("accepts state sync messages from non-host peers", () => {
    const msg: ChannelMessage = {
      type: "state-sync",
      pieces: [{ id: 0, x: 12, y: 34, z: 5, locked: false }],
      lockedCount: 0,
    };

    expect(isAuthorizedPeerMessage("peer-2", msg, "host-1")).toBe(true);
  });

  it("keeps image transfer messages host-only", () => {
    const msg: ChannelMessage = {
      type: "image-meta",
      imageId: "image-1",
      mimeType: "image/jpeg",
      width: 800,
      height: 600,
      chunks: 2,
      byteLength: 1000,
    };

    expect(isAuthorizedPeerMessage("peer-2", msg, "host-1")).toBe(false);
    expect(isAuthorizedPeerMessage("host-1", msg, "host-1")).toBe(true);
  });

  it("accepts selection presence only from the selected participant", () => {
    const msg: ChannelMessage = {
      type: "selection-presence",
      participantId: "peer-1",
      pieceIds: [1, 2],
      imageOverlaySelected: true,
    };

    expect(isAuthorizedPeerMessage("peer-1", msg, "host-1")).toBe(true);
    expect(isAuthorizedPeerMessage("peer-2", msg, "host-1")).toBe(false);
  });
});
