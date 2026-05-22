import { Users } from "lucide-solid";
import { MAX_PARTICIPANTS } from "@open-jigsaw-puzzle/shared/protocol";
import { css, cx } from "../../styled-system/css";
import { fadeUpIn, glassPanel, statChip } from "../styles/recipes";

const root = css({
  position: "absolute",
  top: "16px",
  left: "16px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  md: { top: "10px", left: "10px", padding: "6px", gap: "4px" },
});

const logoBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  minHeight: "32px",
  padding: 0,
  borderRadius: "8px",
  background: "accent",
  color: "#fff",
  font: "700 0.6rem/1 {fonts.mono}",
  letterSpacing: "0.04em",
  border: "none",
  flexShrink: 0,
  boxShadow: "0 2px 8px color-mix(in oklch, {colors.accent} 30%, transparent)",
  _hover: { _enabled: { background: "accent.dim" } },
});

const brandLabel = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  lineHeight: 1,
  md: { display: "none" },
});

const brandRoomLabel = css({
  font: "500 0.56rem/1 {fonts.mono}",
  letterSpacing: "0.14em",
  color: "glass.textDim",
  textTransform: "uppercase",
});

const brandRoomId = css({
  font: "600 0.9rem/1 {fonts.mono}",
  color: "glass.text",
  letterSpacing: "0.05em",
});

const divider = css({
  width: "1px",
  height: "22px",
  background:
    "color-mix(in oklch, {colors.glass.text} 18%, transparent)",
  flexShrink: 0,
  md: { display: "none" },
});

const stats = css({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  md: { display: "none" },
});

type Props = {
  roomId: string | undefined;
  participantCount: number;
  lockedCount: number;
  totalPieces: number;
  onLogoClick: () => void;
};

export function CornerPanelTL(props: Props) {
  return (
    <div class={cx(glassPanel(), root, fadeUpIn(80))}>
      <button
        class={logoBtn}
        onClick={props.onLogoClick}
        title="ホームへ戻る"
        aria-label="ホームへ戻る"
      >
        OP
      </button>
      <div class={brandLabel}>
        <span class={brandRoomLabel}>Room</span>
        <strong class={brandRoomId}>{props.roomId ?? "–"}</strong>
      </div>
      <span class={divider} />
      <div class={stats}>
        <span class={statChip}>
          <Users size={11} />
          {props.participantCount}/{MAX_PARTICIPANTS}
        </span>
        <span class={statChip}>
          {props.lockedCount}/{props.totalPieces || "–"}
        </span>
      </div>
    </div>
  );
}
