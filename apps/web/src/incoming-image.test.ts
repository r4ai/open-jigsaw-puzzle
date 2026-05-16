import { describe, expect, it } from "vitest";
import { createIncomingImage, storeIncomingImageChunk } from "./incoming-image";

describe("incoming image transfer", () => {
  it("assembles chunks only after every in-range chunk arrives", () => {
    const incoming = createIncomingImage({ imageId: "image-1", chunks: 2, byteLength: 8, width: 640, height: 480 });

    expect(incoming).not.toBeNull();
    expect(storeIncomingImageChunk(incoming!, 0, "data:")).toEqual({ chunksReceived: 1, dataUrl: null });
    expect(storeIncomingImageChunk(incoming!, 1, "url")).toEqual({ chunksReceived: 2, dataUrl: "data:url" });
  });

  it("rejects out-of-range chunks without counting them toward completion", () => {
    const incoming = createIncomingImage({ imageId: "image-1", chunks: 2, byteLength: 8, width: 640, height: 480 });

    expect(incoming).not.toBeNull();
    expect(storeIncomingImageChunk(incoming!, 2, "evil")).toBeNull();
    expect(storeIncomingImageChunk(incoming!, 0, "data:")).toEqual({ chunksReceived: 1, dataUrl: null });
  });

  it("rejects invalid metadata before allocating a receive buffer", () => {
    expect(createIncomingImage({ imageId: "image-1", chunks: 0, byteLength: 8, width: 640, height: 480 })).toBeNull();
    expect(createIncomingImage({ imageId: "image-1", chunks: 2, byteLength: 0, width: 640, height: 480 })).toBeNull();
    expect(createIncomingImage({ imageId: "image-1", chunks: 2, byteLength: 8, width: 640, height: 0 })).toBeNull();
  });
});
