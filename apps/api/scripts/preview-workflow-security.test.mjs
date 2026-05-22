import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewWorkflow = readFileSync(new URL("../../../.github/workflows/preview.yml", import.meta.url), "utf8");
const ciWorkflow = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");

describe("preview workflow security boundary", () => {
  it("deploys only after unprivileged CI has produced a preview bundle", () => {
    expect(previewWorkflow).toContain("workflow_run:");
    expect(previewWorkflow).toContain("workflows:");
    expect(previewWorkflow).toContain("- CI");
    expect(previewWorkflow).toContain("Download verified preview bundle");
    expect(ciWorkflow).toContain("Upload preview bundle");
  });

  it("does not run pull request checkout, package install, tests, or builds with Cloudflare secrets", () => {
    expect(previewWorkflow).not.toContain("actions/checkout");
    expect(previewWorkflow).not.toMatch(/\bpnpm\b/);
    expect(previewWorkflow).not.toMatch(/\bnpm (ci|install)\b(?! --global "wrangler@)/);
    expect(previewWorkflow).not.toMatch(/\bpnpm (test|typecheck|build|install)\b/);
  });

  it("uses pull_request_target only for cleanup without checking out pull request code", () => {
    expect(previewWorkflow).toContain("pull_request_target:");
    expect(previewWorkflow).toContain("github.event_name == 'pull_request_target'");
    expect(previewWorkflow).toContain("github.event.action == 'closed'");
    expect(previewWorkflow).toContain("Cleanup PR preview");
  });
});
