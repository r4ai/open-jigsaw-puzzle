import { describe, expect, it } from "vitest";

import {
  buildPreviewCleanedComment,
  buildPreviewDeployedComment,
  buildPreviewPendingComment,
  planManagedPreviewComment,
} from "./preview-comment.ts";

describe("preview comment helpers", () => {
  it("builds a pending comment for a newer commit before the preview is redeployed", () => {
    expect(
      buildPreviewPendingComment({
        commitSha: "abcdef1234567890",
        host: "pr-4.puzzle.example.com",
        previewName: "open-jigsaw-puzzle-pr-4",
        previewUrl: "https://pr-4.puzzle.example.com",
      }),
    ).toBe(
      [
        "<!-- open-puzzle-preview -->",
        "## Preview environment",
        "",
        "Status: waiting for CI before updating the preview.",
        "",
        "URL: https://pr-4.puzzle.example.com",
        "Host: `pr-4.puzzle.example.com`",
        "Worker: `open-jigsaw-puzzle-pr-4`",
        "D1: `open-jigsaw-puzzle-pr-4`",
        "Commit: `abcdef1234567890`",
      ].join("\n"),
    );
  });

  it("builds a deployed comment for the verified commit", () => {
    expect(
      buildPreviewDeployedComment({
        commitSha: "abcdef1234567890",
        host: "pr-4.puzzle.example.com",
        previewName: "open-jigsaw-puzzle-pr-4",
        previewUrl: "https://pr-4.puzzle.example.com",
      }),
    ).toContain("Status: deployed.");
  });

  it("builds a cleaned comment", () => {
    expect(buildPreviewCleanedComment({ previewName: "open-jigsaw-puzzle-pr-4" })).toBe(
      [
        "<!-- open-puzzle-preview -->",
        "## Preview environment",
        "",
        "Status: cleaned up.",
        "",
        "Cleaned up preview resources for `open-jigsaw-puzzle-pr-4`.",
      ].join("\n"),
    );
  });

  it("updates the newest managed comment and deletes older duplicates", () => {
    const body = buildPreviewDeployedComment({
      commitSha: "abcdef1234567890",
      host: "pr-4.puzzle.example.com",
      previewName: "open-jigsaw-puzzle-pr-4",
      previewUrl: "https://pr-4.puzzle.example.com",
    });

    expect(
      planManagedPreviewComment(
        [
          { id: 11, body: "<!-- open-puzzle-preview -->\nold", created_at: "2026-05-22T09:00:00Z" },
          { id: 12, body: "unrelated", created_at: "2026-05-22T09:01:00Z" },
          { id: 13, body: "<!-- open-puzzle-preview -->\nolder", created_at: "2026-05-22T09:02:00Z" },
        ],
        body,
      ),
    ).toEqual({
      body,
      create: false,
      deleteCommentIds: [11],
      updateCommentId: 13,
    });
  });

  it("creates a managed comment when none exists", () => {
    const body = buildPreviewCleanedComment({ previewName: "open-jigsaw-puzzle-pr-4" });

    expect(planManagedPreviewComment([{ id: 11, body: "unrelated" }], body)).toEqual({
      body,
      create: true,
      deleteCommentIds: [],
    });
  });
});
