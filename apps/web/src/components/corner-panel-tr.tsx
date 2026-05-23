import { Check, Moon, Settings as SettingsIcon, Share2, Sun } from "lucide-solid";
import type { Participant } from "@open-jigsaw-puzzle/shared/protocol";
import { css, cx } from "../../styled-system/css";
import { fadeUpIn, glassIconButton, glassPanel } from "../styles/recipes";
import { AvatarStack } from "./avatar-stack";

const root = css({
  position: "absolute",
  top: "16px",
  right: "16px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 8px",
  md: { top: "10px", right: "10px", padding: "6px", gap: "4px" },
});

const divider = css({
  display: "none",
  width: "1px",
  height: "22px",
  background: "color-mix(in oklch, {colors.glass.text} 18%, transparent)",
  flexShrink: 0,
  marginLeft: "4px",
  md: { display: "block" },
});

const shareBtn = css({
  height: "32px",
  minHeight: "32px",
  padding: "0 11px",
  gap: "5px",
  background: "transparent",
  border: "1px solid transparent",
  color: "glass.text",
  borderRadius: "DEFAULT",
  fontSize: "0.8125rem",
  fontWeight: 500,
  transition: "all 120ms",
  _hover: {
    _enabled: {
      background: "color-mix(in oklch, {colors.glass.text} 10%, transparent)",
    },
  },
});

const shareBtnCopied = css({
  background: "color-mix(in oklch, {colors.accent} 20%, transparent)!",
  borderColor:
    "color-mix(in oklch, {colors.accent} 40%, transparent)!",
  color: "accent!",
});

const actionText = css({ display: "none", md: { display: "inline" } });

type Props = {
  participants: Participant[];
  isDark: boolean;
  copied: boolean;
  onShare: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
};

export function CornerPanelTR(props: Props) {
  return (
    <div class={cx(glassPanel(), root, fadeUpIn(160))}>
      <AvatarStack participants={props.participants} />
      <span class={divider} />
      <button
        class={cx(shareBtn, props.copied ? shareBtnCopied : "")}
        onClick={props.onShare}
        title="共有リンクをコピー"
      >
        {props.copied ? <Check size={13} /> : <Share2 size={13} />}
        <span class={actionText}>
          {props.copied ? "コピー済み" : "共有"}
        </span>
      </button>
      <button
        class={glassIconButton()}
        onClick={props.onOpenSettings}
        title="設定"
        aria-label="設定"
      >
        <SettingsIcon size={16} />
      </button>
      <button
        class={glassIconButton()}
        onClick={props.onToggleTheme}
        title={props.isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        aria-label="テーマ切替"
      >
        {props.isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
