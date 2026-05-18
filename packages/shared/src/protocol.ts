import * as v from "valibot";

export const DIFFICULTIES = [48, 96, 192, 300, 500, 1000, 2000] as const;
export const BASIC_DIFFICULTIES = [48, 96, 192] as const;
export const ADVANCED_DIFFICULTIES = [300, 500, 1000, 2000] as const;
export const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_ID_LENGTH = 10;
export const ROOM_TTL_SECONDS = 60 * 60 * 2;
export const MAX_PARTICIPANTS = 6;
export const MAX_CHANNEL_MESSAGE_BYTES = 1024 * 1024;
export const MAX_IMAGE_CHUNK_BYTES = 20_000;
export const MAX_IMAGE_CHUNKS = 4096;
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1280;
export const MAX_SYNCED_PIECES = 2000;
export const MAX_COORDINATE = 1_000_000_000;
export const MAX_Z_INDEX = 1_000_000_000;
export const MAX_SIGNALING_MESSAGE_BYTES = 64 * 1024;

export const DifficultySchema = v.picklist(DIFFICULTIES);

const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1));
export const RoomIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toUpperCase(),
  v.length(ROOM_ID_LENGTH),
  v.regex(new RegExp(`^[${ROOM_ID_ALPHABET}]+$`)),
);
const ParticipantIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
const SafeNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(24));
const ImageIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(80));
const PieceIdSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_SYNCED_PIECES - 1));
const CoordinateSchema = v.pipe(v.number(), v.finite(), v.minValue(-MAX_COORDINATE), v.maxValue(MAX_COORDINATE));
const ZIndexSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_Z_INDEX));
const PositiveIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(1));
const NonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const ErrorResponseSchema = v.object({
  error: v.string(),
});

export const RoomSummarySchema = v.object({
  id: NonEmptyStringSchema,
  difficulty: DifficultySchema,
  expiresAt: NonNegativeIntegerSchema,
  participantCount: NonNegativeIntegerSchema,
});

export const RoomResponseSchema = v.object({
  room: RoomSummarySchema,
});

export const CreateRoomRequestSchema = v.object({
  difficulty: DifficultySchema,
});

export const RoomIdParamsSchema = v.object({
  roomId: RoomIdSchema,
});

export const IceServerConfigSchema = v.object({
  urls: v.union([v.string(), v.array(v.string())]),
  username: v.optional(v.string()),
  credential: v.optional(v.string()),
});

export const IceConfigSchema = v.object({
  iceServers: v.array(IceServerConfigSchema),
});

export const ParticipantSchema = v.object({
  id: ParticipantIdSchema,
  name: SafeNameSchema,
  isHost: v.boolean(),
});

export const SessionDescriptionInitSchema = v.object({
  type: v.picklist(["offer", "answer", "pranswer", "rollback"] as const),
  sdp: v.optional(v.pipe(v.string(), v.maxLength(MAX_SIGNALING_MESSAGE_BYTES))),
});

export const IceCandidateInitSchema = v.object({
  candidate: v.optional(v.pipe(v.string(), v.maxLength(4096))),
  sdpMid: v.optional(v.union([v.pipe(v.string(), v.maxLength(128)), v.null_()])),
  sdpMLineIndex: v.optional(v.union([v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(256)), v.null_()])),
  usernameFragment: v.optional(v.union([v.pipe(v.string(), v.maxLength(256)), v.null_()])),
});

export const PeerSignalSchema = v.variant("type", [
  v.object({
    type: v.literal("offer"),
    description: v.object({
      type: v.literal("offer"),
      sdp: v.optional(v.pipe(v.string(), v.maxLength(MAX_SIGNALING_MESSAGE_BYTES))),
    }),
  }),
  v.object({
    type: v.literal("answer"),
    description: v.object({
      type: v.literal("answer"),
      sdp: v.optional(v.pipe(v.string(), v.maxLength(MAX_SIGNALING_MESSAGE_BYTES))),
    }),
  }),
  v.object({
    type: v.literal("ice"),
    candidate: IceCandidateInitSchema,
  }),
]);

export const SignalEnvelopeSchema = v.variant("type", [
  v.object({
    type: v.literal("hello"),
    participantId: ParticipantIdSchema,
    participants: v.array(ParticipantSchema),
    room: RoomSummarySchema,
  }),
  v.object({
    type: v.literal("peer-joined"),
    participant: ParticipantSchema,
    participants: v.array(ParticipantSchema),
  }),
  v.object({
    type: v.literal("peer-left"),
    participantId: ParticipantIdSchema,
    hostId: v.union([ParticipantIdSchema, v.null_()]),
    participants: v.array(ParticipantSchema),
  }),
  v.object({
    type: v.literal("participant-updated"),
    participant: ParticipantSchema,
    participants: v.array(ParticipantSchema),
  }),
  v.object({
    type: v.literal("signal"),
    from: ParticipantIdSchema,
    to: ParticipantIdSchema,
    payload: PeerSignalSchema,
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

export const ClientSignalMessageSchema = v.variant("type", [
  v.object({
    type: v.literal("signal"),
    to: ParticipantIdSchema,
    payload: PeerSignalSchema,
  }),
  v.object({
    type: v.literal("update-name"),
    name: v.unknown(),
  }),
]);

const CursorSchema = v.object({
  x: CoordinateSchema,
  y: CoordinateSchema,
});

const SyncedPieceSchema = v.object({
  id: PieceIdSchema,
  x: CoordinateSchema,
  y: CoordinateSchema,
  z: ZIndexSchema,
  locked: v.boolean(),
});

const SelectionPieceIdsSchema = v.pipe(
  v.array(PieceIdSchema),
  v.maxLength(MAX_SYNCED_PIECES),
  v.check((pieceIds) => new Set(pieceIds).size === pieceIds.length, "Piece ids must be unique."),
);

const SyncedPiecesSchema = v.pipe(v.array(SyncedPieceSchema), v.maxLength(MAX_SYNCED_PIECES));

export const ChannelMessageSchema = v.variant("type", [
  v.object({
    type: v.literal("presence"),
    participantId: ParticipantIdSchema,
    name: SafeNameSchema,
    cursor: v.union([CursorSchema, v.null_()]),
  }),
  v.object({
    type: v.literal("request-image"),
    participantId: ParticipantIdSchema,
  }),
  v.object({
    type: v.literal("image-meta"),
    imageId: ImageIdSchema,
    mimeType: v.picklist(["image/jpeg", "image/png"] as const),
    width: v.pipe(PositiveIntegerSchema, v.maxValue(MAX_IMAGE_EDGE)),
    height: v.pipe(PositiveIntegerSchema, v.maxValue(MAX_IMAGE_EDGE)),
    chunks: v.pipe(PositiveIntegerSchema, v.maxValue(MAX_IMAGE_CHUNKS)),
    byteLength: v.pipe(PositiveIntegerSchema, v.maxValue(MAX_IMAGE_BYTES)),
  }),
  v.object({
    type: v.literal("image-chunk"),
    imageId: ImageIdSchema,
    index: NonNegativeIntegerSchema,
    data: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_IMAGE_CHUNK_BYTES)),
  }),
  v.object({
    type: v.literal("piece-front"),
    pieceId: PieceIdSchema,
    z: ZIndexSchema,
    by: ParticipantIdSchema,
  }),
  v.object({
    type: v.literal("piece-move"),
    pieceId: PieceIdSchema,
    x: CoordinateSchema,
    y: CoordinateSchema,
    z: ZIndexSchema,
    by: ParticipantIdSchema,
  }),
  v.object({
    type: v.literal("piece-lock"),
    pieceId: PieceIdSchema,
    x: CoordinateSchema,
    y: CoordinateSchema,
    z: ZIndexSchema,
    by: ParticipantIdSchema,
  }),
  v.object({
    type: v.literal("selection-presence"),
    participantId: ParticipantIdSchema,
    pieceIds: SelectionPieceIdsSchema,
    imageOverlaySelected: v.boolean(),
  }),
  v.pipe(
    v.object({
      type: v.literal("state-sync"),
      pieces: SyncedPiecesSchema,
      lockedCount: NonNegativeIntegerSchema,
      by: v.optional(ParticipantIdSchema),
    }),
    v.check((message) => message.lockedCount <= message.pieces.length, "Locked count cannot exceed piece count."),
  ),
  v.object({
    type: v.literal("image-overlay"),
    x: CoordinateSchema,
    y: CoordinateSchema,
    locked: v.optional(v.boolean(), false),
    opacity: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), 1),
  }),
]);

export type Difficulty = v.InferOutput<typeof DifficultySchema>;
export type RoomSummary = v.InferOutput<typeof RoomSummarySchema>;
export type IceConfig = v.InferOutput<typeof IceConfigSchema>;
export type IceServerConfig = v.InferOutput<typeof IceServerConfigSchema>;
export type Participant = v.InferOutput<typeof ParticipantSchema>;
export type SignalEnvelope = v.InferOutput<typeof SignalEnvelopeSchema>;
export type PeerSignal = v.InferOutput<typeof PeerSignalSchema>;
export type SessionDescriptionInit = v.InferOutput<typeof SessionDescriptionInitSchema>;
export type IceCandidateInit = v.InferOutput<typeof IceCandidateInitSchema>;
export type ChannelMessage = v.InferOutput<typeof ChannelMessageSchema>;
export type SyncedPiece = v.InferOutput<typeof SyncedPieceSchema>;
export type ClientSignalMessage = v.InferOutput<typeof ClientSignalMessageSchema>;
export type CreateRoomRequest = v.InferOutput<typeof CreateRoomRequestSchema>;

export function parseChannelMessage(value: unknown): ChannelMessage | null {
  const result = v.safeParse(ChannelMessageSchema, value);
  return result.success ? result.output : null;
}

export function parseSignalEnvelope(value: unknown): SignalEnvelope | null {
  const result = v.safeParse(SignalEnvelopeSchema, value);
  return result.success ? result.output : null;
}

export function parseClientSignalMessage(value: unknown): ClientSignalMessage | null {
  const result = v.safeParse(ClientSignalMessageSchema, value);
  return result.success ? result.output : null;
}

export function isPeerSignal(value: unknown): value is PeerSignal {
  return v.safeParse(PeerSignalSchema, value).success;
}
