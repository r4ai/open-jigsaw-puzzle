import { resolver } from "hono-openapi";
import {
  ErrorResponseSchema,
  IceConfigSchema,
  RoomResponseSchema,
} from "@open-puzzle/shared/protocol";

export const OPENAPI_DOCUMENTATION = {
  info: {
    title: "Open Puzzle API",
    version: "0.1.0",
    description: "REST contract for room metadata and WebRTC ICE configuration.",
  },
  servers: [{ url: "/", description: "Current origin" }],
};

export const jsonContent = <TSchema>(schema: TSchema) => ({
  "application/json": { schema: resolver(schema as never) },
});

export const ERROR_RESPONSES = {
  400: {
    description: "Bad request",
    content: jsonContent(ErrorResponseSchema),
  },
  404: {
    description: "Not found",
    content: jsonContent(ErrorResponseSchema),
  },
  410: {
    description: "Gone",
    content: jsonContent(ErrorResponseSchema),
  },
  413: {
    description: "Payload too large",
    content: jsonContent(ErrorResponseSchema),
  },
  429: {
    description: "Too many requests",
    content: jsonContent(ErrorResponseSchema),
  },
  500: {
    description: "Internal server error",
    content: jsonContent(ErrorResponseSchema),
  },
};

export const ROOM_RESPONSE_CONTENT = jsonContent(RoomResponseSchema);
export const ICE_RESPONSE_CONTENT = jsonContent(IceConfigSchema);
