import { MAX_IMAGE_BYTES, MAX_IMAGE_CHUNKS, MAX_IMAGE_EDGE, MAX_IMAGE_CHUNK_BYTES } from "@open-puzzle/shared/protocol";

export type IncomingImage = {
  imageId: string;
  chunks: Array<string | undefined>;
  expected: number;
  byteLength: number;
  receivedBytes: number;
  mimeType: SafeImageMimeType;
  width: number;
  height: number;
};

export type IncomingImageMeta = {
  imageId: string;
  mimeType: string;
  chunks: number;
  byteLength: number;
  width: number;
  height: number;
};

const SAFE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

type SafeImageMimeType = (typeof SAFE_IMAGE_MIME_TYPES)[number];

export function createIncomingImage(meta: IncomingImageMeta): IncomingImage | null {
  if (!meta.imageId) return null;
  const mimeType = parseSafeImageMimeType(meta.mimeType);
  if (!mimeType) return null;
  if (!isPositiveInteger(meta.chunks) || meta.chunks > MAX_IMAGE_CHUNKS) return null;
  if (!isPositiveInteger(meta.byteLength) || meta.byteLength > MAX_IMAGE_BYTES) return null;
  if (!isPositiveInteger(meta.width) || !isPositiveInteger(meta.height)) return null;
  if (meta.width > MAX_IMAGE_EDGE || meta.height > MAX_IMAGE_EDGE) return null;

  return {
    imageId: meta.imageId,
    chunks: Array.from({ length: meta.chunks }),
    expected: meta.chunks,
    byteLength: meta.byteLength,
    receivedBytes: 0,
    mimeType,
    width: meta.width,
    height: meta.height,
  };
}

export function storeIncomingImageChunk(
  incoming: IncomingImage,
  index: number,
  data: string,
): { chunksReceived: number; dataUrl: string | null } | null {
  if (!Number.isInteger(index) || index < 0 || index >= incoming.expected) return null;
  if (!data || data.length > MAX_IMAGE_CHUNK_BYTES) return null;

  const existing = incoming.chunks[index];
  if (existing !== undefined && existing !== data) return null;
  if (existing === undefined) {
    const nextReceivedBytes = incoming.receivedBytes + data.length;
    if (nextReceivedBytes > incoming.byteLength) return null;
    incoming.receivedBytes = nextReceivedBytes;
  }
  incoming.chunks[index] = data;

  const chunksReceived = countReceivedChunks(incoming.chunks);
  const dataUrl = chunksReceived === incoming.expected ? incoming.chunks.join("") : null;
  if (dataUrl && !isSafeImageDataUrl(dataUrl, incoming.mimeType, incoming.byteLength)) return null;
  return {
    chunksReceived,
    dataUrl,
  };
}

function countReceivedChunks(chunks: Array<string | undefined>): number {
  let count = 0;
  for (const chunk of chunks) {
    if (chunk !== undefined) count += 1;
  }
  return count;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function parseSafeImageMimeType(value: string): SafeImageMimeType | null {
  return SAFE_IMAGE_MIME_TYPES.includes(value as SafeImageMimeType)
    ? (value as SafeImageMimeType)
    : null;
}

function isSafeImageDataUrl(dataUrl: string, mimeType: SafeImageMimeType, expectedLength: number): boolean {
  if (dataUrl.length !== expectedLength) return false;
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) return false;
  const encoded = dataUrl.slice(prefix.length);
  return encoded.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded);
}
