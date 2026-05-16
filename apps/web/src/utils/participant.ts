export const PARTICIPANT_COLORS = [
  "#0f9f8f", "#d94f70", "#7a5cff", "#e2871a",
  "#2f7dd1", "#47a447", "#c14db2", "#8b6b3d",
] as const;

export function participantColor(participantId: string): string {
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) >>> 0;
  }
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length];
}
