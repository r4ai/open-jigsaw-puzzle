import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialTheme } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getInitialTheme", () => {
  it("falls back to prefers-color-scheme when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
    } as MediaQueryList)));

    expect(getInitialTheme()).toBe("dark");
  });
});
