import type { RateBucket } from "./types";

export function consumeRateLimit(buckets: Map<string, RateBucket>, key: string, limit: number, now = Date.now()): boolean {
  for (const [bucketKey, bucket] of buckets) {
    if (now - bucket.windowStartedAt > 60_000) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= 60_000) {
    buckets.set(key, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function consumeSocketRateLimit(buckets: Map<WebSocket, RateBucket>, socket: WebSocket, limit: number, now = Date.now()): boolean {
  const bucket = buckets.get(socket);
  if (!bucket || now - bucket.windowStartedAt >= 60_000) {
    buckets.set(socket, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function getClientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
