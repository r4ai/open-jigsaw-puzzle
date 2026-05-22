import { Rows3 } from "lucide-solid";
import { css, cx } from "../../styled-system/css";
import { fadeUpIn, glassPanel } from "../styles/recipes";

const root = css({
  position: "absolute",
  bottom: "16px",
  left: "16px",
  md: { bottom: "10px", left: "10px" },
});

const btn = css({
  height: "38px",
  minHeight: "38px",
  padding: "0 14px",
  gap: "6px",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "glass.text",
  borderRadius: "DEFAULT",
  _hover: {
    _enabled: {
      background: "color-mix(in oklch, {colors.glass.text} 10%, transparent)",
    },
  },
});

const actionText = css({ md: { display: "none" } });

type Props = {
  onOrganize: () => void;
};

export function CornerPanelBL(props: Props) {
  return (
    <div class={cx(root, fadeUpIn(280))}>
      <button
        class={cx(glassPanel(), btn)}
        onClick={props.onOrganize}
        title="未固定ピースを盤面の下に並べる"
      >
        <Rows3 size={13} />
        <span class={actionText}>整理</span>
      </button>
    </div>
  );
}
