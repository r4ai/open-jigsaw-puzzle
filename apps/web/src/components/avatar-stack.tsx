import { For, Show, createMemo } from "solid-js";
import { Crown } from "lucide-solid";
import type { Participant } from "@open-jigsaw-puzzle/shared/protocol";
import { participantColor } from "../utils/participant";
import { css } from "../../styled-system/css";

const SIZE = 30;

const avatar = css({
  position: "relative",
  width: `${SIZE}px`,
  height: `${SIZE}px`,
  borderRadius: "50%",
  background:
    "color-mix(in oklch, var(--participant-color) 28%, {colors.glass.strong})",
  color: "var(--participant-color)",
  border: "1.5px solid {colors.glass.borderStrong}",
  outline: "2px solid {colors.canvas}",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  font: `600 ${Math.round(SIZE * 0.4)}px/1 {fonts.ui}`,
  textTransform: "uppercase",
  flexShrink: 0,
  zIndex: 1,
});

const hostBadge = css({
  position: "absolute",
  top: "-3px",
  right: "-3px",
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  background: "orange",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px solid {colors.canvas}",
  fontSize: 0,
});

const overflowBubble = css({
  marginLeft: "-8px",
  width: `${SIZE}px`,
  height: `${SIZE}px`,
  borderRadius: "50%",
  background: "glass.strong",
  color: "glass.text",
  border: "1.5px solid {colors.glass.borderStrong}",
  outline: "2px solid {colors.canvas}",
  display: "none",
  alignItems: "center",
  justifyContent: "center",
  font: "600 11px/1 {fonts.mono}",
  flexShrink: 0,
  sm: { display: "flex" },
});

const stack = css({
  display: "flex",
  alignItems: "center",
  paddingRight: "4px",
});

type Props = {
  participants: Participant[];
  max?: number;
};

export function AvatarStack(props: Props) {
  const max = () => props.max ?? 4;
  const visible = createMemo(() => props.participants.slice(0, max()));
  const overflow = createMemo(() => props.participants.length - visible().length);

  return (
    <div class={stack}>
      <For each={visible()}>
        {(p, i) => (
          <div
            class={avatar}
            style={{
              "margin-left": i() === 0 ? "0" : "-8px",
              "--participant-color": participantColor(p.id),
            }}
            title={p.name + (p.isHost ? " (Host)" : "")}
          >
            {p.name.charAt(0)}
            <Show when={p.isHost}>
              <span class={hostBadge}>
                <Crown size={7} />
              </span>
            </Show>
          </div>
        )}
      </For>
      <Show when={overflow() > 0}>
        <div class={overflowBubble}>+{overflow()}</div>
      </Show>
    </div>
  );
}
