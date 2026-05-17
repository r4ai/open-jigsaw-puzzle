import createClient from "openapi-fetch";
import type { paths } from "./openapi";

export const apiClient = createClient<paths>({ baseUrl: "/" });

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (isErrorResponse(error)) return error.error;
  return fallback;
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}
