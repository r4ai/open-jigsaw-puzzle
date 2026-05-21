import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Moon,
  MousePointer2,
  Rows3,
  Settings,
  Sun,
  Users,
} from "lucide-solid";
import { MAX_PARTICIPANTS } from "@open-jigsaw-puzzle/shared/protocol";
import {
  brandMark,
  roomId as roomIdCls,
  roomIdLabel,
  roomInfo,
  shareText,
  sidebarToggle,
  statChip,
  themeToggle,
  topActions,
  topbar,
  topbarLeft,
  topbarSep,
  topbarSpacer,
  topbarStats,
} from "./Topbar.styles";

type Props = {
  roomId: string | undefined;
  participantCount: number;
  connectedPeers: number;
  lockedCount: number;
  totalPieces: number;
  difficulty: number;
  isDark: boolean;
  sidebarOpen: boolean;
  copied: boolean;
  canOrganize: boolean;
  onOrganize: () => void;
  onCopyShareUrl: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
};

export function Topbar(props: Props) {
  return (
    <header class={topbar}>
      <div class={topbarLeft}>
        <span class={brandMark}>OP</span>
        <div class={roomInfo}>
          <span class={roomIdLabel}>Room</span>
          <strong class={roomIdCls}>{props.roomId ?? "–"}</strong>
        </div>
      </div>

      <span class={topbarSep} />

      <div class={topbarStats}>
        <span class={statChip}>
          <Users size={11} />
          {props.participantCount}/{MAX_PARTICIPANTS}
        </span>
        <span class={statChip}>
          <MousePointer2 size={11} />
          {props.connectedPeers} P2P
        </span>
        <span class={statChip}>
          {props.lockedCount}/{props.totalPieces || props.difficulty} locked
        </span>
      </div>

      <span class={topbarSpacer} />

      <div class={topActions}>
        <button
          onClick={props.onOrganize}
          disabled={!props.canOrganize}
          title="未固定ピースを盤面の下に並べる"
        >
          <Rows3 size={15} />
          整理
        </button>
        <button onClick={props.onCopyShareUrl} title="共有リンクをコピー">
          {props.copied ? <Check size={15} /> : <Copy size={15} />}
          <span class={shareText}>{props.copied ? "コピー済み" : "共有"}</span>
        </button>
        <button
          class={themeToggle}
          onClick={props.onOpenSettings}
          title="表示設定を開く"
          aria-label="表示設定を開く"
        >
          <Settings size={18} />
        </button>
        <button
          class={themeToggle}
          onClick={props.onToggleTheme}
          title={
            props.isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"
          }
        >
          {props.isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          class={`${themeToggle} ${sidebarToggle}`}
          onClick={props.onToggleSidebar}
          title={
            props.sidebarOpen
              ? "参加者パネルを閉じる"
              : "参加者パネルを開く"
          }
        >
          {props.sidebarOpen ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>
    </header>
  );
}
