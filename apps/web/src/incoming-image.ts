export type IncomingImage = {
  imageId: string;
  chunks: Array<string | undefined>;
  expected: number;
  byteLength: number;
  width: number;
  height: number;
};

export type IncomingImageMeta = {
  imageId: string;
  chunks: number;
  byteLength: number;
  width: number;
  height: number;
};

const MAX_INCOMING_CHUNKS = 4096;
const MAX_INCOMING_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_INCOMING_IMAGE_EDGE = 1280;

export function createIncomingImage(meta: IncomingImageMeta): IncomingImage | null {
  if (!meta.imageId) return null;
  if (!isPositiveInteger(meta.chunks) || meta.chunks > MAX_INCOMING_CHUNKS) return null;
  if (!isPositiveInteger(meta.byteLength) || meta.byteLength > MAX_INCOMING_IMAGE_BYTES) return null;
  if (!isPositiveInteger(meta.width) || !isPositiveInteger(meta.height)) return null;
  if (meta.width > MAX_INCOMING_IMAGE_EDGE || meta.height > MAX_INCOMING_IMAGE_EDGE) return null;

  return {
    imageId: meta.imageId,
    chunks: Array.from({ length: meta.chunks }),
    expected: meta.chunks,
    byteLength: meta.byteLength,
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
  if (!data) return null;

  const existing = incoming.chunks[index];
  if (existing !== undefined && existing !== data) return null;
  incoming.chunks[index] = data;

  const chunksReceived = countReceivedChunks(incoming.chunks);
  return {
    chunksReceived,
    dataUrl: chunksReceived === incoming.expected ? incoming.chunks.join("") : null,
  };
}

export function countReceivedChunks(chunks: Array<string | undefined>): number {
  let count = 0;
  for (const chunk of chunks) {
    if (chunk !== undefined) count += 1;
  }
  return count;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
