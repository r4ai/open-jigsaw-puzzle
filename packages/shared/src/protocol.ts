export const DIFFICULTIES = [48, 96, 192] as const;
export const ROOM_ID_LENGTH = 10;
export const ROOM_TTL_SECONDS = 60 * 60 * 2;
export const MAX_PARTICIPANTS = 6;

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
  | { type: "state-sync"; pieces: SyncedPiece[]; lockedCount: number };

export type SyncedPiece = {
  id: number;
  x: number;
  y: number;
  z: number;
  locked: boolean;
};
