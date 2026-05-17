/// <reference types="@cloudflare/workers-types" />

export type Env = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
  ROOM_TTL_SECONDS?: string;
  MAX_PARTICIPANTS?: string;
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
};
