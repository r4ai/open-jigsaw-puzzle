import * as v from "valibot";
import { DIFFICULTIES, DifficultySchema, MAX_PARTICIPANTS, ROOM_ID_ALPHABET, ROOM_ID_LENGTH, ROOM_TTL_SECONDS, type Difficulty } from "./protocol";

const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);
const DECIMAL_INTEGER_PATTERN = /^[1-9][0-9]*$/;
type RandomBytes = (bytes: Uint8Array) => Uint8Array;

export function parseDifficulty(value: unknown): Difficulty | null {
  const parsed = typeof value === "string" && DECIMAL_INTEGER_PATTERN.test(value) ? Number(value) : value;
  const result = v.safeParse(DifficultySchema, parsed);
  return result.success ? result.output : null;
}

export function sanitizeName(value: unknown): string {
  if (typeof value !== "string") return "Player";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Player";
  return trimmed.slice(0, 24);
}

export function createRoomId(random: RandomBytes = crypto.getRandomValues.bind(crypto)): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  random(bytes);
  return [...bytes].map((byte) => ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length]).join("");
}

export function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(normalized) ? normalized : null;
}

export function expiresAt(nowSeconds: number, ttlSeconds = ROOM_TTL_SECONDS): number {
  return nowSeconds + ttlSeconds;
}

export function assertCanJoin(participantCount: number, nowSeconds: number, expirySeconds: number, maxParticipants = MAX_PARTICIPANTS): void {
  if (nowSeconds >= expirySeconds) {
    throw new Error("This room has expired.");
  }
  if (participantCount >= maxParticipants) {
    throw new Error("This room is full.");
  }
}
