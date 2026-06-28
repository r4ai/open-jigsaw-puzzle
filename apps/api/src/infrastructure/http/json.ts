const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const utf8Encoder = new TextEncoder();

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

export function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength;
}
