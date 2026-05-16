export type LoadingProgress =
  | { phase: "idle" }
  | { phase: "connecting"; startedAt: number }
  | { phase: "resizing"; fileName: string; sourceBytes: number; startedAt: number }
  | { phase: "sending"; chunksSent: number; totalChunks: number; byteLength: number; target: "all" | "peer"; startedAt: number }
  | { phase: "receiving"; imageId: string; chunksReceived: number; totalChunks: number; byteLength: number; startedAt: number }
  | { phase: "complete"; detail: string };

export function describeLoadingProgress(progress: LoadingProgress): string | null {
  switch (progress.phase) {
    case "idle":
      return null;
    case "connecting":
      return `部屋へ接続中 (${formatElapsed(progress.startedAt)})`;
    case "resizing":
      return `画像をリサイズ中: ${progress.fileName} / ${formatBytes(progress.sourceBytes)} (${formatElapsed(progress.startedAt)})`;
    case "sending": {
      const percent = getPercent(progress.chunksSent, progress.totalChunks);
      return `画像を配布中: ${percent}% (${progress.chunksSent}/${progress.totalChunks} チャンク, ${formatBytes(progress.byteLength)})`;
    }
    case "receiving": {
      const percent = getPercent(progress.chunksReceived, progress.totalChunks);
      const remaining = progress.totalChunks - progress.chunksReceived;
      const estimate = estimateRemaining(progress.chunksReceived, progress.totalChunks, progress.startedAt);
      return `画像を受信中: ${percent}% (${progress.chunksReceived}/${progress.totalChunks} チャンク, 残り ${remaining}, 目安 ${estimate}, ${formatBytes(progress.byteLength)})`;
    }
    case "complete":
      return progress.detail;
  }
}

function getPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function estimateRemaining(done: number, total: number, startedAt: number): string {
  if (done <= 0) return "計算中";
  const elapsedSeconds = Math.max(0.1, (Date.now() - startedAt) / 1000);
  const remainingSeconds = Math.max(0, ((total - done) * elapsedSeconds) / done);
  if (remainingSeconds < 1) return "1秒未満";
  if (remainingSeconds < 60) return `約${Math.ceil(remainingSeconds)}秒`;
  return `約${Math.ceil(remainingSeconds / 60)}分`;
}

function formatElapsed(startedAt: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${elapsedSeconds}秒経過`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
}
