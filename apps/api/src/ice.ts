import type { IceConfig, IceServerConfig } from "@open-puzzle/shared/protocol";
import type { Env } from "./types";

export function getIceConfig(env: Env): IceConfig {
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
