import { Check, ChevronLeft, ChevronRight, Copy, Moon, MousePointer2, Rows3, Sun, Users } from "lucide-react";
import { MAX_PARTICIPANTS } from "@open-puzzle/shared/protocol";
import styles from "./Topbar.module.css";

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
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <span className={styles.brandMark}>OP</span>
        <div className={styles.roomInfo}>
          <span className={styles.roomIdLabel}>Room</span>
          <strong className={styles.roomId}>{roomId ?? "–"}</strong>
        </div>
      </div>

      <span className={styles.topbarSep} />

      <div className={styles.topbarStats}>
        <span className={styles.statChip}>
          <Users size={11} />
          {participantCount}/{MAX_PARTICIPANTS}
        </span>
        <span className={styles.statChip}>
          <MousePointer2 size={11} />
          {connectedPeers} P2P
        </span>
        <span className={styles.statChip}>
          {lockedCount}/{totalPieces || difficulty} locked
        </span>
      </div>

      <span className={styles.topbarSpacer} />

      <div className={styles.topActions}>
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
          className={styles.themeToggle}
          onClick={onToggleTheme}
          title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className={`${styles.themeToggle} ${styles.sidebarToggle}`}
          onClick={onToggleSidebar}
          title={sidebarOpen ? "参加者パネルを閉じる" : "参加者パネルを開く"}
        >
          {sidebarOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </header>
  );
}
