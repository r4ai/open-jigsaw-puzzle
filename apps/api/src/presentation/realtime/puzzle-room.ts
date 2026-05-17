import {
  MAX_PARTICIPANTS,
  MAX_SIGNALING_MESSAGE_BYTES,
  ROOM_TTL_SECONDS,
  parseClientSignalMessage,
  type Participant,
  type SignalEnvelope,
} from "@open-jigsaw-puzzle/shared/protocol";
import { assertCanJoin, normalizeRoomId, sanitizeName } from "@open-jigsaw-puzzle/shared/rooms";
import { roomSummary } from "../../application/rooms";
import type { Env } from "../../infrastructure/cloudflare/bindings";
import { readEnvPositiveInteger } from "../../infrastructure/cloudflare/env";
import { createD1RoomEventRepository, createD1RoomRepository } from "../../infrastructure/d1/rooms-repository";
import { json, parseJson } from "../../infrastructure/http/json";
import { consumeSocketRateLimit, type RateBucket } from "../../infrastructure/rate-limit/window";
import { systemClock } from "../../infrastructure/time/clock";
import { MAX_WS_MESSAGES_PER_MINUTE } from "./constants";

type SocketAttachment = {
  participantId: string;
  name: string;
  isHost: boolean;
};

export class PuzzleRoom implements DurableObject {
  private sessions = new Map<WebSocket, SocketAttachment>();
  private messageRateLimits = new Map<WebSocket, RateBucket>();

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

    if (upgradeHeader !== "websocket") return json({ error: "Expected WebSocket upgrade." }, 426);
    if (!isAllowedWebSocketOrigin(request)) return json({ error: "Forbidden origin." }, 403);
    if (!roomId) return json({ error: "Room id is required." }, 400);

    const rooms = createD1RoomRepository(this.env.DB, systemClock);
    const events = createD1RoomEventRepository(this.env.DB, systemClock);
    const room = await rooms.read(roomId);
    if (!room) return json({ error: "Room not found." }, 404);

    const now = systemClock();
    const maxParticipants = readEnvPositiveInteger(this.env.MAX_PARTICIPANTS, MAX_PARTICIPANTS);
    try {
      assertCanJoin(this.sessions.size, now, room.expiresAt, maxParticipants);
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
    const updatedRoom = await rooms.touch(roomId, this.sessions.size, readEnvPositiveInteger(this.env.ROOM_TTL_SECONDS, ROOM_TTL_SECONDS));
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

    await events.record(roomId, "join", { participantId, name });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    if (message.length > MAX_SIGNALING_MESSAGE_BYTES || !consumeSocketRateLimit(this.messageRateLimits, socket, MAX_WS_MESSAGES_PER_MINUTE)) {
      socket.close(1008, "Message limit exceeded.");
      await this.removeSocket(socket);
      return;
    }
    const sender = this.sessions.get(socket);
    if (!sender) return;

    const parsedJson = parseJson<unknown>(message);
    if (!parsedJson) return;
    const parsed = parseClientSignalMessage(parsedJson);
    if (!parsed) return;

    if (parsed.type === "update-name") {
      const nextName = sanitizeName(parsed.name);
      if (sender.name === nextName) return;
      sender.name = nextName;
      socket.serializeAttachment(sender);
      const participant = toParticipant(sender);
      const participants = this.participants();
      this.broadcast({
        type: "participant-updated",
        participant,
        participants,
      });
      this.state.waitUntil(createD1RoomEventRepository(this.env.DB, systemClock).record(this.state.id.name || "", "rename", { participantId: sender.participantId, name: nextName }));
      return;
    }

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
    this.messageRateLimits.delete(socket);

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
    const rooms = createD1RoomRepository(this.env.DB, systemClock);
    const events = createD1RoomEventRepository(this.env.DB, systemClock);
    this.state.waitUntil(rooms.touch(roomId, this.sessions.size, readEnvPositiveInteger(this.env.ROOM_TTL_SECONDS, ROOM_TTL_SECONDS)));
    this.state.waitUntil(events.record(roomId, "leave", { participantId: attachment.participantId }));

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

export function isAllowedWebSocketOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function toParticipant(attachment: SocketAttachment): Participant {
  return {
    id: attachment.participantId,
    name: attachment.name,
    isHost: attachment.isHost,
  };
}
