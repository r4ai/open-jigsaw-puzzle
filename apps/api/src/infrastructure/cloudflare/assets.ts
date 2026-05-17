import type { Env } from "./bindings";

export async function serveAssetOrSpa(request: Request, env: Env): Promise<Response> {
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
