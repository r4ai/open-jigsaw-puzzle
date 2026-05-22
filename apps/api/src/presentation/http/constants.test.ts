/// <reference types="node" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "./constants";

describe("security headers", () => {
  it("keeps the CSP inline script hash in sync with the web theme bootstrap", () => {
    const htmlPath = decodeURIComponent(new URL("../../../../web/index.html", import.meta.url).pathname);
    const html = readFileSync(htmlPath, "utf8");
    const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];

    expect(script).toBeTruthy();
    const hash = createHash("sha256").update(script!).digest("base64");

    expect(SECURITY_HEADERS["content-security-policy"]).toContain(`'sha256-${hash}'`);
  });
});
