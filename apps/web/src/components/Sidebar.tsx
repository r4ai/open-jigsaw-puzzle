import { Check } from "lucide-react";
import type { Participant } from "@open-jigsaw-puzzle/shared/protocol";
import { participantColor } from "../utils/participant";
import styles from "./Sidebar.module.css";

type Props = {
  myParticipant: Participant | undefined;
  participants: Participant[];
  draftName: string;
  sidebarOpen: boolean;
  onDraftNameChange: (name: string) => void;
  onDraftNameBlur: () => void;
  onSaveName: () => void;
  nameChanged: boolean;
};

export function Sidebar({
  myParticipant,
  participants,
  draftName,
  sidebarOpen,
  onDraftNameChange,
  onDraftNameBlur,
  onSaveName,
  nameChanged,
}: Props) {
  return (
    <aside className={`${styles.people} ${!sidebarOpen ? styles.hidden : ""}`}>
      {myParticipant ? (
        <div className={styles.nameEditorWrap}>
          <span className={styles.nameEditorLabel}>あなたの表示名</span>
          <div className={styles.nameEditor}>
            <input
              aria-label="表示名"
              value={draftName}
              maxLength={24}
              onChange={(e) => onDraftNameChange(e.target.value)}
              onBlur={onDraftNameBlur}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveName(); }}
            />
            <button type="button" disabled={!nameChanged} title="表示名を保存" onClick={onSaveName}>
              <Check size={14} />
            </button>
          </div>
        </div>
      ) : null}
      <div className={styles.memberList}>
        {participants.length > 0 && <p className={styles.peopleSubheader}>メンバー</p>}
        {participants.map((participant) => (
          <div key={participant.id} className={styles.person}>
            <div
              className={styles.personAvatar}
              style={{ "--participant-color": participantColor(participant.id) } as React.CSSProperties & Record<"--participant-color", string>}
            >
              {participant.name.charAt(0)}
            </div>
            <span>{participant.name}</span>
            {participant.isHost ? <strong className={styles.hostBadge}>Host</strong> : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
