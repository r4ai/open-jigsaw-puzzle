import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";

/**
 * Returns true if `msg` is allowed to originate from `from`, given the current
 * `hostId`. Used to drop spoofed or unauthorized peer messages before they are
 * dispatched to the puzzle, cursor, and image-overlay handlers.
 */
export function isAuthorizedPeerMessage(
  from: string,
  msg: ChannelMessage,
  hostId: string | null,
): boolean {
  switch (msg.type) {
    case "presence":
      return msg.participantId === from;
    case "request-image":
      return msg.participantId === from;
    case "piece-front":
    case "piece-move":
    case "piece-moves":
    case "piece-lock":
    case "piece-locks":
      return msg.by === from;
    case "selection-presence":
      return msg.participantId === from;
    case "state-sync":
    case "image-overlay":
      return hostId === from;
    case "puzzle-completed":
      return msg.by === from && hostId === from;
    case "image-meta":
    case "image-chunk":
      return hostId === from;
  }
}

/**
 * True when a keyboard event represents an undo/redo (Ctrl/Cmd+Z) intent that
 * should be handled globally — i.e. not while focus is inside a text field.
 */
export function isUndoRedoShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== "z") return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.altKey) return false;
  const target = event.target;
  return !(
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}
