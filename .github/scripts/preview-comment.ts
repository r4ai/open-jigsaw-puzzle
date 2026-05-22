export const previewCommentMarker = "<!-- open-puzzle-preview -->";

export type PreviewCommentOptions = {
  commitSha: string;
  host: string;
  previewName: string;
  previewUrl: string;
};

export type CleanupPreviewCommentOptions = {
  previewName: string;
};

export type PreviewComment = {
  id: number;
  body?: string | null;
  created_at?: string;
};

export type ManagedPreviewCommentPlan = {
  body: string;
  create: boolean;
  deleteCommentIds: number[];
  updateCommentId?: number;
};

export function buildPreviewPendingComment({ commitSha, host, previewName, previewUrl }: PreviewCommentOptions): string {
  return buildPreviewComment([
    "Status: waiting for CI before updating the preview.",
    "",
    `URL: ${previewUrl}`,
    `Host: \`${host}\``,
    `Worker: \`${previewName}\``,
    `D1: \`${previewName}\``,
    `Commit: \`${commitSha}\``,
  ]);
}

export function buildPreviewDeployedComment({ commitSha, host, previewName, previewUrl }: PreviewCommentOptions): string {
  return buildPreviewComment([
    "Status: deployed.",
    "",
    `URL: ${previewUrl}`,
    `Host: \`${host}\``,
    `Worker: \`${previewName}\``,
    `D1: \`${previewName}\``,
    `Commit: \`${commitSha}\``,
  ]);
}

export function buildPreviewCleanedComment({ previewName }: CleanupPreviewCommentOptions): string {
  return buildPreviewComment(["Status: cleaned up.", "", `Cleaned up preview resources for \`${previewName}\`.`]);
}

export function planManagedPreviewComment(comments: PreviewComment[], body: string): ManagedPreviewCommentPlan {
  const managedComments = comments
    .filter((comment) => comment.body?.includes(previewCommentMarker))
    .toSorted(compareCommentAge);

  const commentToUpdate = managedComments.at(-1);
  const deleteCommentIds = managedComments.slice(0, -1).map((comment) => comment.id);

  if (!commentToUpdate) {
    return {
      body,
      create: true,
      deleteCommentIds,
    };
  }

  return {
    body,
    create: false,
    deleteCommentIds,
    updateCommentId: commentToUpdate.id,
  };
}

function buildPreviewComment(lines: string[]): string {
  return [previewCommentMarker, "## Preview environment", "", ...lines].join("\n");
}

function compareCommentAge(left: PreviewComment, right: PreviewComment): number {
  const leftTime = Date.parse(left.created_at ?? "");
  const rightTime = Date.parse(right.created_at ?? "");

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.id - right.id;
}
