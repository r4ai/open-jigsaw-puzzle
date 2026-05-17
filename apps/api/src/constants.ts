export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
export const MAX_CREATE_ROOM_BODY_BYTES = 1024;
export const MAX_CREATE_ROOM_REQUESTS_PER_MINUTE = 20;
export const MAX_WS_MESSAGES_PER_MINUTE = 1_800;

export const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
