import { useEffect, useRef, useState } from "react";
import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import { createPuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { ChannelMessage, RoomSummary, SyncedPiece } from "@open-puzzle/shared/protocol";
import { chunkString, resizeImage } from "../image";
import { createIncomingImage, rememberIncomingImage, storeIncomingImageChunk } from "../incoming-image";
import type { IncomingImage } from "../incoming-image";
import { countLockedPieces } from "../utils/puzzle-ops";
import { formatBytes } from "../utils/format";
import type { LoadingProgress } from "../utils/format";

type Props = {
  send: (to: string, msg: ChannelMessage) => void;
  broadcast: (msg: ChannelMessage) => void;
  room: RoomSummary | null;
  getPieces: () => BoardPiece[];
  onImageComplete: (dataUrl: string, width: number, height: number, layout: PuzzleLayout) => void;
};

export function useImageTransfer({ send, broadcast, room, getPieces, onImageComplete }: Props) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ phase: "idle" });

  const imageDataRef = useRef<string | null>(null);
  const imageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const roomRef = useRef<RoomSummary | null>(null);
  const incomingRef = useRef<Map<string, IncomingImage>>(new Map());

  const sendRef = useRef(send);
  const broadcastRef = useRef(broadcast);
  const getPiecesRef = useRef(getPieces);
  const onImageCompleteRef = useRef(onImageComplete);

  useEffect(() => { sendRef.current = send; }, [send]);
  useEffect(() => { broadcastRef.current = broadcast; }, [broadcast]);
  useEffect(() => { getPiecesRef.current = getPieces; }, [getPieces]);
  useEffect(() => { onImageCompleteRef.current = onImageComplete; }, [onImageComplete]);
  useEffect(() => { roomRef.current = room; }, [room]);

  function setImage(dataUrl: string, width: number, height: number) {
    imageDataRef.current = dataUrl;
    imageSizeRef.current = { width, height };
    setImageDataUrl(dataUrl);
    setImageSize({ width, height });
  }

  function clearImage() {
    imageDataRef.current = null;
    imageSizeRef.current = null;
    setImageDataUrl(null);
    setImageSize(null);
    incomingRef.current.clear();
  }

  function sendImage(
    dataUrl = imageDataRef.current,
    width = imageSizeRef.current?.width,
    height = imageSizeRef.current?.height,
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
    if (to) sendRef.current(to, meta);
    else broadcastRef.current(meta);

    let lastProgressAt = startedAt;
    chunks.forEach((data, index) => {
      const chunkMsg: ChannelMessage = { type: "image-chunk", imageId, index, data };
      if (to) sendRef.current(to, chunkMsg);
      else broadcastRef.current(chunkMsg);
      const now = Date.now();
      if (index === chunks.length - 1 || now - lastProgressAt >= 100) {
        lastProgressAt = now;
        setLoadingProgress({ phase: "sending", chunksSent: index + 1, totalChunks: chunks.length, byteLength: dataUrl.length, target: to ? "peer" : "all", startedAt });
      }
    });
    setLoadingProgress({ phase: "complete", detail: `${chunks.length} チャンク / ${formatBytes(dataUrl.length)} を配布しました` });
  }

  function sendSnapshot(to?: string, piecesOverride?: BoardPiece[]) {
    sendImage(imageDataRef.current, imageSizeRef.current?.width, imageSizeRef.current?.height, to);
    const snapshotPieces = piecesOverride ?? getPiecesRef.current();
    const synced: SyncedPiece[] = snapshotPieces.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    const syncMsg: ChannelMessage = { type: "state-sync", pieces: synced, lockedCount: countLockedPieces(synced) };
    if (to) sendRef.current(to, syncMsg);
    else broadcastRef.current(syncMsg);
  }

  function requestImageFromPeers(myId: string | null) {
    if (!myId || imageDataRef.current) return;
    broadcastRef.current({ type: "request-image", participantId: myId });
  }

  async function handleImageUpload(file: File, currentRoom: RoomSummary) {
    setLoadingProgress({ phase: "resizing", fileName: file.name, sourceBytes: file.size, startedAt: Date.now() });
    const resized = await resizeImage(file);
    const nextLayout = createPuzzleLayout(currentRoom.difficulty, resized.width, resized.height);
    setImage(resized.dataUrl, resized.width, resized.height);
    onImageCompleteRef.current(resized.dataUrl, resized.width, resized.height, nextLayout);
    sendSnapshot(undefined, undefined);
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    switch (msg.type) {
      case "request-image":
        if (imageDataRef.current && imageSizeRef.current) sendSnapshot(msg.participantId);
        break;
      case "image-meta": {
        const incoming = createIncomingImage({
          imageId: msg.imageId,
          mimeType: msg.mimeType,
          chunks: msg.chunks,
          byteLength: msg.byteLength,
          width: msg.width,
          height: msg.height,
        });
        if (!incoming) return;
        rememberIncomingImage(incomingRef.current, incoming);
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
        const incoming = incomingRef.current.get(msg.imageId);
        if (!incoming) return;
        const stored = storeIncomingImageChunk(incoming, msg.index, msg.data);
        if (!stored) return;
        setLoadingProgress((cur) => ({
          phase: "receiving",
          imageId: msg.imageId,
          chunksReceived: stored.chunksReceived,
          totalChunks: incoming.expected,
          byteLength: incoming.byteLength,
          startedAt: cur.phase === "receiving" && cur.imageId === msg.imageId ? cur.startedAt : Date.now(),
        }));
        if (stored.dataUrl) {
          incomingRef.current.delete(msg.imageId);
          setImage(stored.dataUrl, incoming.width, incoming.height);
          const currentRoom = roomRef.current;
          const nextLayout = currentRoom
            ? createPuzzleLayout(currentRoom.difficulty, incoming.width, incoming.height)
            : null;
          if (nextLayout) {
            onImageCompleteRef.current(stored.dataUrl, incoming.width, incoming.height, nextLayout);
          }
          setLoadingProgress({ phase: "complete", detail: `${incoming.expected} チャンクを受信しました` });
        }
        break;
      }
    }
  }

  return {
    imageDataUrl,
    imageSize,
    loadingProgress,
    imageDataRef,
    clearImage,
    handleImageUpload,
    sendSnapshot,
    requestImageFromPeers,
    handleMessage,
  };
}
