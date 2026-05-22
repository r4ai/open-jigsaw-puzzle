export const MAX_CREATE_ROOM_BODY_BYTES = 1024;
export const MAX_CREATE_ROOM_REQUESTS_PER_MINUTE = 20;
export const API_CACHE_CONTROL = "no-store";

export const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'sha256-GtPhZXqtjhOI7Qd03mgXlhXA1FZY19tg5NYyAhh986Y='",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
