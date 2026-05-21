const MAX_IMAGE_EDGE = 1280;
const MAX_UPLOAD_SOURCE_BYTES = 25 * 1024 * 1024;
const SAFE_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

export async function resizeImage(file: File): Promise<{ dataUrl: string; width: number; height: number; mimeType: string }> {
  if (!SAFE_UPLOAD_MIME_TYPES.has(file.type)) {
    throw new Error("JPEG または PNG 画像を選択してください。");
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_SOURCE_BYTES) {
    throw new Error("画像ファイルは 25MB 以下にしてください。");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.drawImage(bitmap, 0, 0, width, height);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  return {
    dataUrl: canvas.toDataURL(mimeType, 0.86),
    width,
    height,
    mimeType,
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIdx === -1) {
    throw new Error("Invalid data URL");
  }
  const header = dataUrl.slice(5, commaIdx);
  const isBase64 = header.endsWith(";base64");
  const mimeType = (isBase64 ? header.slice(0, -7) : header) || "application/octet-stream";
  const payload = dataUrl.slice(commaIdx + 1);
  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

export function chunkString(value: string, size = 16_000): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}
