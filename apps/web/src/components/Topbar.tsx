import { Check, ChevronLeft, ChevronRight, Copy, Moon, MousePointer2, Rows3, Sun, Users } from "lucide-react";
import { MAX_PARTICIPANTS } from "@open-puzzle/shared/protocol";

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
};

export function Topbar({
  roomId,
  participantCount,
  connectedPeers,
  lockedCount,
  totalPieces,
  difficulty,
  isDark,
  sidebarOpen,
  copied,
  canOrganize,
  onOrganize,
  onCopyShareUrl,
  onToggleTheme,
  onToggleSidebar,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand-mark">OP</span>
        <div className="room-info">
          <span className="room-id-label">Room</span>
          <strong className="room-id">{roomId ?? "–"}</strong>
        </div>
      </div>

      <span className="topbar-sep" />

      <div className="topbar-stats">
        <span className="stat-chip">
          <Users size={11} />
          {participantCount}/{MAX_PARTICIPANTS}
        </span>
        <span className="stat-chip">
          <MousePointer2 size={11} />
          {connectedPeers} P2P
        </span>
        <span className="stat-chip">
          {lockedCount}/{totalPieces || difficulty} locked
        </span>
      </div>

      <span className="topbar-spacer" />

      <div className="top-actions">
        <button
          onClick={onOrganize}
          disabled={!canOrganize}
          title="未固定ピースを盤面の下に並べる"
        >
          <Rows3 size={15} />
          整理
        </button>
        <button onClick={onCopyShareUrl} title="共有リンクをコピー">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "コピー済み" : "共有"}
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          className="theme-toggle sidebar-toggle"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "参加者パネルを閉じる" : "参加者パネルを開く"}
        >
          {sidebarOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </header>
  );
}
