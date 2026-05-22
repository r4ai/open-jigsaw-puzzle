export const previewCommentMarker = "<!-- open-puzzle-preview -->";

export function buildPreviewPendingComment({ commitSha, host, previewName, previewUrl }) {
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

export function buildPreviewDeployedComment({ commitSha, host, previewName, previewUrl }) {
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

export function buildPreviewCleanedComment({ previewName }) {
  return buildPreviewComment(["Status: cleaned up.", "", `Cleaned up preview resources for \`${previewName}\`.`]);
}

export function planManagedPreviewComment(comments, body) {
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

function buildPreviewComment(lines) {
  return [previewCommentMarker, "## Preview environment", "", ...lines].join("\n");
}

function compareCommentAge(left, right) {
  const leftTime = Date.parse(left.created_at ?? "");
  const rightTime = Date.parse(right.created_at ?? "");

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.id - right.id;
}
