import { cleanup, renderHook } from "@solidjs/testing-library";
import { createPuzzleLayout, type BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, RoomSummary } from "@open-jigsaw-puzzle/shared/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImageTransfer } from "./use-image-transfer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useImageTransfer", () => {
  it("requests an image only when missing local image data", () => {
    const broadcasts: ChannelMessage[] = [];
    const { result } = renderHook(() => setupTransfer({ broadcast: (message) => broadcasts.push(message) }));

    result.requestImageFromPeers(null);
    result.requestImageFromPeers("local");

    expect(broadcasts).toEqual([{ type: "request-image", participantId: "local" }]);
  });

  it("sends snapshots to a peer with current image and board state", () => {
    const sent: Array<{ to: string; message: ChannelMessage }> = [];
    const { result } = renderHook(() =>
      setupTransfer({
        send: (to, message) => sent.push({ to, message }),
        pieces: [
          { id: 0, x: 10, y: 20, z: 1, locked: true, targetX: 0, targetY: 0 },
          { id: 1, x: 30, y: 40, z: 2, locked: false, targetX: 0, targetY: 0 },
        ],
      }),
    );

    result.handleMessage("host", {
      type: "image-meta",
      imageId: "image-1",
      mimeType: "image/png",
      width: 2,
      height: 2,
      chunks: 1,
      byteLength: pngDataUrl.length,
    });
    result.handleMessage("host", { type: "image-chunk", imageId: "image-1", index: 0, data: pngDataUrl });
    result.sendSnapshot("peer-1");

    expect(sent.map(({ to }) => to)).toEqual(["peer-1", "peer-1", "peer-1"]);
    expect(sent[0]?.message).toMatchObject({ type: "image-meta", width: 2, height: 2, chunks: 1 });
    expect(sent[1]?.message).toMatchObject({ type: "image-chunk", index: 0, data: pngDataUrl });
    expect(sent[2]?.message).toEqual({
      type: "state-sync",
      pieces: [
        { id: 0, x: 10, y: 20, z: 1, locked: true },
        { id: 1, x: 30, y: 40, z: 2, locked: false },
      ],
      lockedCount: 1,
      startedAtMs: 1234,
    });
  });

  it("assembles incoming image chunks and completes the image lifecycle", () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:image-1"),
    });
    const onImageComplete = vi.fn();
    const { result } = renderHook(() => setupTransfer({ onImageComplete }));

    result.handleMessage("host", {
      type: "image-meta",
      imageId: "image-1",
      mimeType: "image/png",
      width: 640,
      height: 480,
      chunks: 2,
      byteLength: pngDataUrl.length,
    });
    result.handleMessage("host", { type: "image-chunk", imageId: "image-1", index: 1, data: pngDataUrl.slice(10) });
    result.handleMessage("host", { type: "image-chunk", imageId: "image-1", index: 0, data: pngDataUrl.slice(0, 10) });

    expect(result.getImageData()).toBe(pngDataUrl);
    expect(result.imageDataUrl()).toBe("blob:image-1");
    expect(result.imageSize()).toEqual({ width: 640, height: 480 });
    expect(result.loadingProgress()).toEqual({ phase: "complete", detail: "2 チャンクを受信しました" });
    expect(onImageComplete).toHaveBeenCalledWith(
      pngDataUrl,
      640,
      480,
      expect.objectContaining({ boardWidth: 640, boardHeight: 480 }),
    );
  });

  it("drops an incoming transfer when the completed data URL is unsafe", () => {
    const unsafeDataUrl = "data:image/png;base64,!!!!!!!!";
    const { result } = renderHook(() => setupTransfer());

    result.handleMessage("host", {
      type: "image-meta",
      imageId: "image-1",
      mimeType: "image/png",
      width: 640,
      height: 480,
      chunks: 1,
      byteLength: unsafeDataUrl.length,
    });
    result.handleMessage("host", { type: "image-chunk", imageId: "image-1", index: 0, data: unsafeDataUrl });

    expect(result.getImageData()).toBeNull();
    expect(result.loadingProgress()).toEqual({ phase: "idle" });
  });
});

const pngDataUrl = "data:image/png;base64,SGVsbG8=";
const room: RoomSummary = {
  id: "room-1",
  difficulty: 48,
  expiresAt: 0,
  participantCount: 2,
};

type SetupOptions = {
  send?: (to: string, message: ChannelMessage) => void;
  broadcast?: (message: ChannelMessage) => void;
  pieces?: BoardPiece[];
  onImageComplete?: (
    dataUrl: string,
    width: number,
    height: number,
    layout: ReturnType<typeof createPuzzleLayout>,
    initialPieces?: BoardPiece[],
  ) => void;
};

function setupTransfer(options: SetupOptions = {}) {
  return useImageTransfer({
    send: options.send ?? (() => {}),
    broadcast: options.broadcast ?? (() => {}),
    room: () => room,
    getPieces: () => options.pieces ?? [],
    getStartedAtMs: () => 1234,
    onImageComplete: options.onImageComplete ?? (() => {}),
  });
}
