import { cleanup, renderHook } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, useSettings } from "./use-settings";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSettings", () => {
  it("loads persisted settings and clamps invalid values", () => {
    localStorage.setItem(
      "open-puzzle:settings:v1",
      JSON.stringify({
        edgeOpacityLocked: -1,
        edgeOpacityUnlocked: 2,
        edgeOpacitySelected: 0.45,
      }),
    );

    const { result } = renderHook(useSettings);

    expect(result.settings()).toEqual({
      edgeOpacityLocked: 0,
      edgeOpacityUnlocked: 1,
      edgeOpacitySelected: 0.45,
    });
  });

  it("falls back to defaults when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    const { result } = renderHook(useSettings);

    expect(result.settings()).toEqual(DEFAULT_SETTINGS);
  });

  it("updates, persists, and resets settings", async () => {
    const { result } = renderHook(useSettings);

    result.update("edgeOpacityUnlocked", 0.25);
    await Promise.resolve();

    expect(result.settings().edgeOpacityUnlocked).toBe(0.25);
    expect(JSON.parse(localStorage.getItem("open-puzzle:settings:v1") ?? "{}")).toMatchObject({
      edgeOpacityUnlocked: 0.25,
    });

    result.reset();

    expect(result.settings()).toEqual(DEFAULT_SETTINGS);
  });
});
