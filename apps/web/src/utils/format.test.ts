import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeLoadingProgress, formatBytes, formatDuration } from "./format";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T00:00:10.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatDuration", () => {
  it.each([
    [0, "00:00"],
    [999, "00:00"],
    [65_000, "01:05"],
    [3_661_000, "1:01:01"],
    [-1_000, "00:00"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1024, "1.0 KiB"],
    [1536, "1.5 KiB"],
    [100 * 1024, "100 KiB"],
    [2.5 * 1024 * 1024, "2.5 MiB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("describeLoadingProgress", () => {
  it("returns null while idle", () => {
    expect(describeLoadingProgress({ phase: "idle" })).toBeNull();
  });

  it("summarizes connection and resize progress", () => {
    expect(describeLoadingProgress({ phase: "connecting", startedAt: Date.now() - 5000 })).toBe(
      "部屋へ接続中 (5秒経過)",
    );
    expect(
      describeLoadingProgress({
        phase: "resizing",
        fileName: "photo.png",
        sourceBytes: 2048,
        startedAt: Date.now() - 1000,
      }),
    ).toBe("画像をリサイズ中: photo.png / 2.0 KiB (1秒経過)");
  });

  it("summarizes sending progress with bounded percentages", () => {
    expect(
      describeLoadingProgress({
        phase: "sending",
        chunksSent: 12,
        totalChunks: 10,
        byteLength: 1536,
        target: "all",
        startedAt: Date.now(),
      }),
    ).toBe("画像を配布中: 100% (12/10 チャンク, 1.5 KiB)");
  });

  it("summarizes receiving progress with remaining estimate", () => {
    expect(
      describeLoadingProgress({
        phase: "receiving",
        imageId: "image-1",
        chunksReceived: 2,
        totalChunks: 5,
        byteLength: 2048,
        startedAt: Date.now() - 2000,
      }),
    ).toBe("画像を受信中: 40% (2/5 チャンク, 残り 3, 目安 約3秒, 2.0 KiB)");
  });

  it("keeps receiving estimates useful before the first chunk and near completion", () => {
    expect(
      describeLoadingProgress({
        phase: "receiving",
        imageId: "image-1",
        chunksReceived: 0,
        totalChunks: 5,
        byteLength: 2048,
        startedAt: Date.now(),
      }),
    ).toContain("目安 計算中");

    expect(
      describeLoadingProgress({
        phase: "receiving",
        imageId: "image-1",
        chunksReceived: 5,
        totalChunks: 5,
        byteLength: 2048,
        startedAt: Date.now() - 2000,
      }),
    ).toContain("目安 1秒未満");
  });
});
