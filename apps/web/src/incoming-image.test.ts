import { describe, expect, it } from "vitest";
import { createIncomingImage, storeIncomingImageChunk } from "./incoming-image";

describe("incoming image transfer", () => {
  it("assembles chunks only after every in-range chunk arrives", () => {
    const incoming = createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 2, byteLength: 31, width: 640, height: 480 });

    expect(incoming).not.toBeNull();
    expect(storeIncomingImageChunk(incoming!, 0, "data:image/jpeg;base64,")).toEqual({ chunksReceived: 1, dataUrl: null });
    expect(storeIncomingImageChunk(incoming!, 1, "aGVsbG8=")).toEqual({ chunksReceived: 2, dataUrl: "data:image/jpeg;base64,aGVsbG8=" });
  });

  it("rejects out-of-range chunks without counting them toward completion", () => {
    const incoming = createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 2, byteLength: 31, width: 640, height: 480 });

    expect(incoming).not.toBeNull();
    expect(storeIncomingImageChunk(incoming!, 2, "evil")).toBeNull();
    expect(storeIncomingImageChunk(incoming!, 0, "data:image/jpeg;base64,")).toEqual({ chunksReceived: 1, dataUrl: null });
  });

  it("rejects invalid metadata before allocating a receive buffer", () => {
    expect(createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 0, byteLength: 8, width: 640, height: 480 })).toBeNull();
    expect(createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 2, byteLength: 0, width: 640, height: 480 })).toBeNull();
    expect(createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 2, byteLength: 8, width: 640, height: 0 })).toBeNull();
    expect(createIncomingImage({ imageId: "image-1", mimeType: "image/svg+xml", chunks: 2, byteLength: 8, width: 640, height: 480 })).toBeNull();
  });

  it("rejects chunks that exceed declared size or assemble to an unsafe data url", () => {
    const oversized = createIncomingImage({ imageId: "image-1", mimeType: "image/jpeg", chunks: 1, byteLength: 8, width: 640, height: 480 });
    expect(oversized).not.toBeNull();
    expect(storeIncomingImageChunk(oversized!, 0, "data:image/jpeg;base64,aGVsbG8=")).toBeNull();

    const unsafe = createIncomingImage({ imageId: "image-2", mimeType: "image/jpeg", chunks: 1, byteLength: 30, width: 640, height: 480 });
    expect(unsafe).not.toBeNull();
    expect(storeIncomingImageChunk(unsafe!, 0, "data:text/html;base64,aGVsbG8=")).toBeNull();
  });
});
