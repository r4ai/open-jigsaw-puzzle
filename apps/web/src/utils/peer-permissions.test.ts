import { describe, expect, it } from "vitest";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { isAuthorizedPeerMessage, isUndoRedoShortcut } from "./peer-permissions";

describe("isAuthorizedPeerMessage", () => {
  it.each([
    [{ type: "presence", participantId: "peer-1", name: "Ada", cursor: null }, true],
    [{ type: "presence", participantId: "other", name: "Ada", cursor: null }, false],
    [{ type: "piece-move", by: "peer-1", pieceId: 1, x: 2, y: 3, z: 4 }, true],
    [{ type: "piece-move", by: "other", pieceId: 1, x: 2, y: 3, z: 4 }, false],
    [{ type: "state-sync", pieces: [], lockedCount: 0 }, true],
    [{ type: "image-meta", imageId: "img", mimeType: "image/png", width: 1, height: 1, chunks: 1, byteLength: 1 }, true],
    [{ type: "puzzle-completed", by: "peer-1", elapsedMs: 1000 }, true],
    [{ type: "puzzle-completed", by: "other", elapsedMs: 1000 }, false],
  ] satisfies Array<[ChannelMessage, boolean]>)(
    "returns %s for %o",
    (message, expected) => {
      expect(isAuthorizedPeerMessage("peer-1", message, "peer-1")).toBe(expected);
    },
  );

  it.each([
    { type: "state-sync", pieces: [], lockedCount: 0 },
    { type: "image-meta", imageId: "img", mimeType: "image/png", width: 1, height: 1, chunks: 1, byteLength: 1 },
    { type: "image-overlay", x: 0, y: 0, locked: false, opacity: 1 },
  ] satisfies ChannelMessage[])("rejects host-only messages from non-host peers: %o", (message) => {
    expect(isAuthorizedPeerMessage("peer-1", message, "host")).toBe(false);
  });
});

describe("isUndoRedoShortcut", () => {
  it("accepts ctrl+z outside editable fields", () => {
    expect(isUndoRedoShortcut(keyboardEvent({ key: "z", ctrlKey: true }))).toBe(true);
  });

  it("rejects shortcuts from editable targets", () => {
    const input = document.createElement("input");

    expect(isUndoRedoShortcut(keyboardEvent({ key: "z", ctrlKey: true, target: input }))).toBe(false);
  });

  it("rejects alt-modified undo shortcuts", () => {
    expect(isUndoRedoShortcut(keyboardEvent({ key: "z", ctrlKey: true, altKey: true }))).toBe(false);
  });
});

function keyboardEvent(init: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: EventTarget;
}): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    target: init.target ?? document.createElement("div"),
  } as KeyboardEvent;
}
