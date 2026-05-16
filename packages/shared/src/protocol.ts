export const DIFFICULTIES = [48, 96, 192] as const;
export const ROOM_ID_LENGTH = 10;
export const ROOM_TTL_SECONDS = 60 * 60 * 2;
export const MAX_PARTICIPANTS = 6;
export const MAX_CHANNEL_MESSAGE_BYTES = 128 * 1024;
export const MAX_IMAGE_CHUNK_BYTES = 20_000;
export const MAX_IMAGE_CHUNKS = 4096;
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1280;
export const MAX_SYNCED_PIECES = 192;
export const MAX_COORDINATE = 1_000_000_000;
export const MAX_Z_INDEX = 1_000_000_000;

export type Difficulty = (typeof DIFFICULTIES)[number];

export type RoomSummary = {
  id: string;
  difficulty: Difficulty;
  expiresAt: number;
  participantCount: number;
};

export type IceConfig = {
  iceServers: IceServerConfig[];
};

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type Participant = {
  id: string;
  name: string;
  isHost: boolean;
};

export type SignalEnvelope =
  | {
      type: "hello";
      participantId: string;
      participants: Participant[];
      room: RoomSummary;
    }
  | {
      type: "peer-joined";
      participant: Participant;
      participants: Participant[];
    }
  | {
      type: "peer-left";
      participantId: string;
      hostId: string | null;
      participants: Participant[];
    }
  | {
      type: "participant-updated";
      participant: Participant;
      participants: Participant[];
    }
  | {
      type: "signal";
      from: string;
      to: string;
      payload: PeerSignal;
    }
  | {
      type: "error";
      message: string;
    };

export type PeerSignal =
  | { type: "offer"; description: SessionDescriptionInit }
  | { type: "answer"; description: SessionDescriptionInit }
  | { type: "ice"; candidate: IceCandidateInit };

export type SessionDescriptionInit = {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
};

export type IceCandidateInit = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type ChannelMessage =
  | { type: "presence"; participantId: string; name: string; cursor: { x: number; y: number } | null }
  | { type: "request-image"; participantId: string }
  | { type: "image-meta"; imageId: string; mimeType: string; width: number; height: number; chunks: number; byteLength: number }
  | { type: "image-chunk"; imageId: string; index: number; data: string }
  | { type: "piece-front"; pieceId: number; z: number; by: string }
  | { type: "piece-move"; pieceId: number; x: number; y: number; z: number; by: string }
  | { type: "piece-lock"; pieceId: number; x: number; y: number; z: number; by: string }
  | { type: "selection-presence"; participantId: string; pieceIds: number[]; imageOverlaySelected: boolean }
  | { type: "state-sync"; pieces: SyncedPiece[]; lockedCount: number }
  | { type: "image-overlay"; x: number; y: number; locked: boolean; opacity: number };

export type SyncedPiece = {
  id: number;
  x: number;
  y: number;
  z: number;
  locked: boolean;
};

export function parseChannelMessage(value: unknown): ChannelMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "presence":
      if (!isParticipantId(value.participantId) || !isSafeName(value.name)) return null;
      {
        const cursor = parseCursor(value.cursor);
        if (cursor === undefined) return null;
        return { type: "presence", participantId: value.participantId, name: value.name, cursor };
      }
    case "request-image":
      return isParticipantId(value.participantId) ? { type: "request-image", participantId: value.participantId } : null;
    case "image-meta":
      if (!isImageId(value.imageId) || !isSafeImageMimeType(value.mimeType)) return null;
      if (!isPositiveInteger(value.width) || !isPositiveInteger(value.height)) return null;
      if (value.width > MAX_IMAGE_EDGE || value.height > MAX_IMAGE_EDGE) return null;
      if (!isPositiveInteger(value.chunks) || value.chunks > MAX_IMAGE_CHUNKS) return null;
      if (!isPositiveInteger(value.byteLength) || value.byteLength > MAX_IMAGE_BYTES) return null;
      return {
        type: "image-meta",
        imageId: value.imageId,
        mimeType: value.mimeType,
        width: value.width,
        height: value.height,
        chunks: value.chunks,
        byteLength: value.byteLength,
      };
    case "image-chunk":
      if (!isImageId(value.imageId) || !isNonNegativeInteger(value.index)) return null;
      if (typeof value.data !== "string" || value.data.length === 0 || value.data.length > MAX_IMAGE_CHUNK_BYTES) return null;
      return { type: "image-chunk", imageId: value.imageId, index: value.index, data: value.data };
    case "piece-front":
      if (!isPieceId(value.pieceId) || !isZIndex(value.z) || !isParticipantId(value.by)) return null;
      return { type: "piece-front", pieceId: value.pieceId, z: value.z, by: value.by };
    case "piece-move":
      if (!isPieceId(value.pieceId) || !isCoordinate(value.x) || !isCoordinate(value.y) || !isZIndex(value.z) || !isParticipantId(value.by)) return null;
      return { type: "piece-move", pieceId: value.pieceId, x: value.x, y: value.y, z: value.z, by: value.by };
    case "piece-lock":
      if (!isPieceId(value.pieceId) || !isCoordinate(value.x) || !isCoordinate(value.y) || !isZIndex(value.z) || !isParticipantId(value.by)) return null;
      return { type: "piece-lock", pieceId: value.pieceId, x: value.x, y: value.y, z: value.z, by: value.by };
    case "selection-presence":
      if (!isParticipantId(value.participantId) || !Array.isArray(value.pieceIds) || typeof value.imageOverlaySelected !== "boolean") return null;
      if (value.pieceIds.length > MAX_SYNCED_PIECES) return null;
      {
        const pieceIds = value.pieceIds.flatMap((pieceId) => (isPieceId(pieceId) ? [pieceId] : []));
        if (pieceIds.length !== value.pieceIds.length) return null;
        if (new Set(pieceIds).size !== pieceIds.length) return null;
        return { type: "selection-presence", participantId: value.participantId, pieceIds, imageOverlaySelected: value.imageOverlaySelected };
      }
    case "state-sync":
      if (!Array.isArray(value.pieces) || value.pieces.length > MAX_SYNCED_PIECES) return null;
      if (!isNonNegativeInteger(value.lockedCount) || value.lockedCount > value.pieces.length) return null;
      {
        const pieces = value.pieces.flatMap((piece) => {
          const parsed = parseSyncedPiece(piece);
          return parsed ? [parsed] : [];
        });
        if (pieces.length !== value.pieces.length) return null;
        return { type: "state-sync", pieces, lockedCount: value.lockedCount };
      }
    case "image-overlay": {
      if (!isCoordinate(value.x) || !isCoordinate(value.y)) return null;
      const locked = typeof value.locked === "boolean" ? value.locked : false;
      const rawOpacity = typeof value.opacity === "number" && Number.isFinite(value.opacity) ? value.opacity : 1;
      return { type: "image-overlay", x: value.x, y: value.y, locked, opacity: Math.max(0, Math.min(1, rawOpacity)) };
    }
    default:
      return null;
  }
}

function parseSyncedPiece(value: unknown): SyncedPiece | null {
  if (!isRecord(value)) return null;
  if (!isPieceId(value.id) || !isCoordinate(value.x) || !isCoordinate(value.y) || !isZIndex(value.z) || typeof value.locked !== "boolean") return null;
  return { id: value.id, x: value.x, y: value.y, z: value.z, locked: value.locked };
}

function parseCursor(value: unknown): { x: number; y: number } | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isCoordinate(value.x) || !isCoordinate(value.y)) return undefined;
  return { x: value.x, y: value.y };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSafeImageMimeType(value: unknown): value is "image/jpeg" | "image/png" {
  return value === "image/jpeg" || value === "image/png";
}

function isParticipantId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function isImageId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}

function isSafeName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 24;
}

function isPieceId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_SYNCED_PIECES;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
}

function isZIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_Z_INDEX;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
