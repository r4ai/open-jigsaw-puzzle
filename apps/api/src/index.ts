/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { MAX_PARTICIPANTS, ROOM_TTL_SECONDS, type Difficulty, type IceServerConfig, type Participant, type PeerSignal, type RoomSummary, type SignalEnvelope } from "@open-puzzle/shared/protocol";
import { assertCanJoin, createRoomId, expiresAt, parseDifficulty, sanitizeName } from "@open-puzzle/shared/rooms";

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

type RoomRow = {
  id: string;
  difficulty: number;
  expires_at: number;
  participant_count: number;
};

type SocketAttachment = {
  participantId: string;
  name: string;
  isHost: boolean;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const app = new Hono<{ Bindings: Env }>();

app.post("/api/rooms", (c) => createRoom(c.req.raw, c.env));

app.get("/api/rooms/:roomId", (c) => {
  const roomId = normalizeRoomId(c.req.param("roomId"));
  if (!roomId) return json({ error: "Room id is required." }, 400);
  return getRoom(roomId, c.env);
});

app.get("/api/rooms/:roomId/socket", (c) => {
  const roomId = normalizeRoomId(c.req.param("roomId"));
  if (!roomId) return json({ error: "Room id is required." }, 400);
  const id = c.env.ROOMS.idFromName(roomId);
  return c.env.ROOMS.get(id).fetch(c.req.raw);
});

app.get("/api/ice", (c) => c.json(getIceConfig(c.env)));

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Not found." }, 404);
  return serveAssetOrSpa(c.req.raw, c.env);
});

export default app;

export class PuzzleRoom implements DurableObject {
  private sessions = new Map<WebSocket, SocketAttachment>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    for (const socket of this.state.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | undefined;
      if (attachment) this.sessions.set(socket, attachment);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade")?.toLowerCase();
    const roomId = normalizeRoomId(url.pathname.split("/")[3]);

    if (upgradeHeader !== "websocket") {
      return json({ error: "Expected WebSocket upgrade." }, 426);
    }
    if (!roomId) return json({ error: "Room id is required." }, 400);

    const room = await readRoom(this.env.DB, roomId);
    if (!room) return json({ error: "Room not found." }, 404);

    const now = nowSeconds();
    const maxParticipants = Number(this.env.MAX_PARTICIPANTS || MAX_PARTICIPANTS);
    try {
      assertCanJoin(this.sessions.size, now, room.expires_at, maxParticipants);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Unable to join room." }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const participantId = crypto.randomUUID();
    const name = sanitizeName(url.searchParams.get("name"));
    const attachment: SocketAttachment = {
      participantId,
      name,
      isHost: ![...this.sessions.values()].some((session) => session.isHost),
    };

    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);
    this.sessions.set(server, attachment);

    const participant = toParticipant(attachment);
    const updatedRoom = await touchRoom(this.env.DB, roomId, this.sessions.size, Number(this.env.ROOM_TTL_SECONDS || ROOM_TTL_SECONDS));
    const participants = this.participants();

    this.send(server, {
      type: "hello",
      participantId,
      participants,
      room: roomSummary(updatedRoom),
    });
    this.broadcast(
      {
        type: "peer-joined",
        participant,
        participants,
      },
      server,
    );

    await recordEvent(this.env.DB, roomId, "join", { participantId, name });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const sender = this.sessions.get(socket);
    if (!sender) return;

    const parsed = parseJson<{ type?: string; to?: string; payload?: PeerSignal }>(message);
    if (!parsed || parsed.type !== "signal" || !parsed.to || !parsed.payload) return;

    for (const [targetSocket, target] of this.sessions) {
      if (target.participantId !== parsed.to) continue;
      this.send(targetSocket, {
        type: "signal",
        from: sender.participantId,
        to: target.participantId,
        payload: parsed.payload,
      });
      return;
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    await this.removeSocket(socket);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.removeSocket(socket);
  }

  private async removeSocket(socket: WebSocket): Promise<void> {
    const attachment = this.sessions.get(socket);
    if (!attachment) return;

    this.sessions.delete(socket);

    if (attachment.isHost && this.sessions.size > 0) {
      const next = this.sessions.values().next().value as SocketAttachment | undefined;
      if (next) {
        next.isHost = true;
        for (const [candidateSocket, candidate] of this.sessions) {
          if (candidate.participantId === next.participantId) {
            candidateSocket.serializeAttachment(candidate);
            break;
          }
        }
      }
    }

    const roomId = this.state.id.name || "";
    this.state.waitUntil(touchRoom(this.env.DB, roomId, this.sessions.size, Number(this.env.ROOM_TTL_SECONDS || ROOM_TTL_SECONDS)));
    this.state.waitUntil(recordEvent(this.env.DB, roomId, "leave", { participantId: attachment.participantId }));

    const participants = this.participants();
    this.broadcast({
      type: "peer-left",
      participantId: attachment.participantId,
      hostId: participants.find((participant) => participant.isHost)?.id ?? null,
      participants,
    });
  }

  private participants(): Participant[] {
    return [...this.sessions.values()].map(toParticipant);
  }

  private broadcast(message: SignalEnvelope, except?: WebSocket): void {
    for (const socket of this.sessions.keys()) {
      if (socket !== except) this.send(socket, message);
    }
  }

  private send(socket: WebSocket, message: SignalEnvelope): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.state.waitUntil(this.removeSocket(socket));
    }
  }
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = parseJson<{ difficulty?: unknown }>(await request.text());
  const difficulty = parseDifficulty(body?.difficulty);
  if (!difficulty) return json({ error: "Difficulty must be 48, 96, or 192." }, 400);

  const now = nowSeconds();
  const ttl = Number(env.ROOM_TTL_SECONDS || ROOM_TTL_SECONDS);

  for (let attempts = 0; attempts < 4; attempts += 1) {
    const id = createRoomId();
    try {
      await env.DB.prepare(
        "INSERT INTO rooms (id, difficulty, created_at, expires_at, participant_count, last_seen_at) VALUES (?, ?, ?, ?, 0, ?)",
      )
        .bind(id, difficulty, now, expiresAt(now, ttl), now)
        .run();
      const [row] = await Promise.all([readRoom(env.DB, id), recordEvent(env.DB, id, "create", { difficulty })]);
      if (!row) return json({ error: "Unable to create room." }, 500);
      return json({ room: roomSummary(row) }, 201);
    } catch (error) {
      if (attempts === 3) throw error;
    }
  }

  return json({ error: "Unable to create room." }, 500);
}

async function getRoom(roomId: string, env: Env): Promise<Response> {
  const row = await readRoom(env.DB, roomId);
  if (!row) return json({ error: "Room not found." }, 404);
  if (nowSeconds() >= row.expires_at) return json({ error: "Room has expired." }, 410);
  return json({ room: roomSummary(row) });
}

async function readRoom(db: D1Database, roomId: string): Promise<RoomRow | null> {
  return db
    .prepare("SELECT id, difficulty, expires_at, participant_count FROM rooms WHERE id = ?")
    .bind(roomId)
    .first<RoomRow>();
}

async function touchRoom(db: D1Database, roomId: string, participantCount: number, ttlSeconds: number): Promise<RoomRow> {
  const now = nowSeconds();
  const expiry = expiresAt(now, ttlSeconds);
  const row = await db
    .prepare(
      "UPDATE rooms SET participant_count = ?, last_seen_at = ?, expires_at = ? WHERE id = ? RETURNING id, difficulty, expires_at, participant_count",
    )
    .bind(participantCount, now, expiry, roomId)
    .first<RoomRow>();
  if (!row) throw new Error("Room disappeared.");
  return row;
}

async function recordEvent(db: D1Database, roomId: string, eventType: string, payload: unknown): Promise<void> {
  await db
    .prepare("INSERT INTO room_events (room_id, event_type, created_at, payload) VALUES (?, ?, ?, ?)")
    .bind(roomId, eventType, nowSeconds(), JSON.stringify(payload))
    .run();
}

function getIceConfig(env: Env): { iceServers: IceServerConfig[] } {
  const servers: IceServerConfig[] = [{ urls: "stun:stun.cloudflare.com:3478" }];
  const turnUrls = env.TURN_URLS?.split(",").flatMap((url) => {
    const trimmed = url.trim();
    return trimmed ? [trimmed] : [];
  }) ?? [];

  if (turnUrls.length > 0 && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    servers.push({
      urls: turnUrls,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }

  return { iceServers: servers };
}

function roomSummary(row: RoomRow): RoomSummary {
  return {
    id: row.id,
    difficulty: row.difficulty as Difficulty,
    expiresAt: row.expires_at,
    participantCount: row.participant_count,
  };
}

function toParticipant(attachment: SocketAttachment): Participant {
  return {
    id: attachment.participantId,
    name: attachment.name,
    isHost: attachment.isHost,
  };
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeRoomId(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

async function serveAssetOrSpa(request: Request, env: Env): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404 || !shouldServeSpaFallback(request)) return assetResponse;

  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  return env.ASSETS.fetch(new Request(url, request));
}

function shouldServeSpaFallback(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
