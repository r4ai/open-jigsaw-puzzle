import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkString, dataUrlToBlob, resizeImage } from "./image";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dataUrlToBlob", () => {
  it("decodes base64 data URLs with their mime type", async () => {
    const blob = dataUrlToBlob("data:text/plain;base64,SGVsbG8=");

    expect(blob.type).toBe("text/plain");
    expect(await readBlob(blob)).toBe("Hello");
  });

  it("decodes URL-encoded data URLs", async () => {
    const blob = dataUrlToBlob("data:,hello%20world");

    expect(blob.type).toBe("application/octet-stream");
    expect(await readBlob(blob)).toBe("hello world");
  });

  it("rejects malformed data URLs", () => {
    expect(() => dataUrlToBlob("not-data")).toThrow("Invalid data URL");
  });
});

async function readBlob(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe("chunkString", () => {
  it("splits values into stable ordered chunks", () => {
    expect(chunkString("abcdef", 2)).toEqual(["ab", "cd", "ef"]);
    expect(chunkString("abcde", 2)).toEqual(["ab", "cd", "e"]);
  });
});

describe("resizeImage", () => {
  it("rejects unsafe image types and oversized sources before decoding", async () => {
    await expect(resizeImage(new File(["x"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow(
      "JPEG または PNG 画像を選択してください。",
    );

    const large = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    await expect(resizeImage(large)).rejects.toThrow("画像ファイルは 25MB 以下にしてください。");
  });

  it("scales large images down to the maximum edge", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2560, height: 1280 })));
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName !== "canvas") return document.createElement(tagName);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: vi.fn(() => "data:image/jpeg;base64,resized"),
      } as unknown as HTMLCanvasElement;
    });

    await expect(resizeImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }))).resolves.toEqual({
      dataUrl: "data:image/jpeg;base64,resized",
      width: 1280,
      height: 640,
      mimeType: "image/jpeg",
    });
  });
});
