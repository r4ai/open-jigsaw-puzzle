import { createSignal, onCleanup } from "solid-js";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import { createInitialPieces, createPuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, RoomSummary, SyncedPiece } from "@open-jigsaw-puzzle/shared/protocol";
import { chunkString, dataUrlToBlob, resizeImage } from "../image";
import { createIncomingImage, rememberIncomingImage, storeIncomingImageChunk } from "../incoming-image";
import type { IncomingImage } from "../incoming-image";
import { countLockedPieces } from "../utils/puzzle-ops";
import { formatBytes } from "../utils/format";
import type { LoadingProgress } from "../utils/format";

function revokeIfBlobUrl(url: string): void {
  if (!url.startsWith("blob:")) return;
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  URL.revokeObjectURL(url);
}

type Props = {
  send: (to: string, msg: ChannelMessage) => void;
  broadcast: (msg: ChannelMessage) => void;
  room: () => RoomSummary | null;
  getPieces: () => BoardPiece[];
  getStartedAtMs: () => number | null;
  onImageComplete: (dataUrl: string, width: number, height: number, layout: PuzzleLayout) => void;
};

/**
 * Sends and receives the puzzle image across the peer mesh as chunked data
 * URLs, exposing the resulting object URL and loading progress.
 */
export function useImageTransfer(props: Props) {
  const [imageObjectUrl, setImageObjectUrl] = createSignal<string | null>(null);
  const [imageSize, setImageSize] = createSignal<{ width: number; height: number } | null>(null);
  const [loadingProgress, setLoadingProgress] = createSignal<LoadingProgress>({ phase: "idle" });

  let imageDataNow: string | null = null;
  let imageObjectUrlNow: string | null = null;
  let imageSizeNow: { width: number; height: number } | null = null;
  const incoming = new Map<string, IncomingImage>();

  function replaceObjectUrl(nextUrl: string | null) {
    const prev = imageObjectUrlNow;
    if (prev && prev !== nextUrl) revokeIfBlobUrl(prev);
    imageObjectUrlNow = nextUrl;
    setImageObjectUrl(nextUrl);
  }

  function setImage(dataUrl: string, width: number, height: number) {
    imageDataNow = dataUrl;
    imageSizeNow = { width, height };
    let nextUrl: string;
    try {
      nextUrl = URL.createObjectURL(dataUrlToBlob(dataUrl));
    } catch {
      nextUrl = dataUrl;
    }
    replaceObjectUrl(nextUrl);
    setImageSize({ width, height });
  }

  function clearImage() {
    imageDataNow = null;
    imageSizeNow = null;
    replaceObjectUrl(null);
    setImageSize(null);
    incoming.clear();
  }

  onCleanup(() => {
    if (imageObjectUrlNow) revokeIfBlobUrl(imageObjectUrlNow);
    imageObjectUrlNow = null;
  });

  function sendImage(
    dataUrl = imageDataNow,
    width = imageSizeNow?.width,
    height = imageSizeNow?.height,
    to?: string,
  ) {
    if (!dataUrl || !width || !height) return;
    const imageId = crypto.randomUUID();
    const chunks = chunkString(dataUrl);
    const startedAt = Date.now();
    setLoadingProgress({ phase: "sending", chunksSent: 0, totalChunks: chunks.length, byteLength: dataUrl.length, target: to ? "peer" : "all", startedAt });
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
    if (mimeType !== "image/jpeg" && mimeType !== "image/png") return;
    const meta: ChannelMessage = {
      type: "image-meta",
      imageId,
      mimeType,
      width,
      height,
      chunks: chunks.length,
      byteLength: dataUrl.length,
    };
    if (to) props.send(to, meta);
    else props.broadcast(meta);

    let lastProgressAt = startedAt;
    chunks.forEach((data, index) => {
      const chunkMsg: ChannelMessage = { type: "image-chunk", imageId, index, data };
      if (to) props.send(to, chunkMsg);
      else props.broadcast(chunkMsg);
      const now = Date.now();
      if (index === chunks.length - 1 || now - lastProgressAt >= 100) {
        lastProgressAt = now;
        setLoadingProgress({ phase: "sending", chunksSent: index + 1, totalChunks: chunks.length, byteLength: dataUrl.length, target: to ? "peer" : "all", startedAt });
      }
    });
    setLoadingProgress({ phase: "complete", detail: `${chunks.length} チャンク / ${formatBytes(dataUrl.length)} を配布しました` });
  }

  function sendSnapshot(to?: string, piecesOverride?: BoardPiece[]) {
    sendImage(imageDataNow, imageSizeNow?.width, imageSizeNow?.height, to);
    const snapshotPieces = piecesOverride ?? props.getPieces();
    const synced: SyncedPiece[] = snapshotPieces.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    const syncMsg: ChannelMessage = { type: "state-sync", pieces: synced, lockedCount: countLockedPieces(synced), startedAtMs: props.getStartedAtMs() };
    if (to) props.send(to, syncMsg);
    else props.broadcast(syncMsg);
  }

  function requestImageFromPeers(myId: string | null) {
    if (!myId || imageDataNow) return;
    props.broadcast({ type: "request-image", participantId: myId });
  }

  async function handleImageUpload(file: File, currentRoom: RoomSummary) {
    setLoadingProgress({ phase: "resizing", fileName: file.name, sourceBytes: file.size, startedAt: Date.now() });
    const resized = await resizeImage(file);
    const nextLayout = createPuzzleLayout(currentRoom.difficulty, resized.width, resized.height);
    const nextPieces = createInitialPieces(nextLayout);
    setImage(resized.dataUrl, resized.width, resized.height);
    props.onImageComplete(resized.dataUrl, resized.width, resized.height, nextLayout);
    sendSnapshot(undefined, nextPieces);
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    switch (msg.type) {
      case "request-image":
        if (imageDataNow && imageSizeNow) sendSnapshot(msg.participantId);
        break;
      case "image-meta": {
        const next = createIncomingImage({
          imageId: msg.imageId,
          mimeType: msg.mimeType,
          chunks: msg.chunks,
          byteLength: msg.byteLength,
          width: msg.width,
          height: msg.height,
        });
        if (!next) return;
        rememberIncomingImage(incoming, next);
        setLoadingProgress({
          phase: "receiving",
          imageId: msg.imageId,
          chunksReceived: 0,
          totalChunks: msg.chunks,
          byteLength: msg.byteLength,
          startedAt: Date.now(),
        });
        break;
      }
      case "image-chunk": {
        const target = incoming.get(msg.imageId);
        if (!target) return;
        const stored = storeIncomingImageChunk(target, msg.index, msg.data);
        if (!stored) return;
        setLoadingProgress((cur) => ({
          phase: "receiving",
          imageId: msg.imageId,
          chunksReceived: stored.chunksReceived,
          totalChunks: target.expected,
          byteLength: target.byteLength,
          startedAt: cur.phase === "receiving" && cur.imageId === msg.imageId ? cur.startedAt : Date.now(),
        }));
        if (stored.dataUrl) {
          incoming.delete(msg.imageId);
          setImage(stored.dataUrl, target.width, target.height);
          const currentRoom = props.room();
          const nextLayout = currentRoom
            ? createPuzzleLayout(currentRoom.difficulty, target.width, target.height)
            : null;
          if (nextLayout) {
            props.onImageComplete(stored.dataUrl, target.width, target.height, nextLayout);
          }
          setLoadingProgress({ phase: "complete", detail: `${target.expected} チャンクを受信しました` });
        }
        break;
      }
    }
  }

  return {
    imageDataUrl: imageObjectUrl,
    imageSize,
    loadingProgress,
    getImageData: () => imageDataNow,
    clearImage,
    handleImageUpload,
    sendSnapshot,
    requestImageFromPeers,
    handleMessage,
  };
}
