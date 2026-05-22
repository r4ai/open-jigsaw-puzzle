import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialTheme, setTheme } from "./theme";

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

describe("setTheme", () => {
  it("applies the document theme and persists the preference", () => {
    setTheme("dark");

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("still applies the document theme when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    setTheme("light");

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
