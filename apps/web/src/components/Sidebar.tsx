import { Check } from "lucide-react";
import type { Participant } from "@open-puzzle/shared/protocol";
import { participantColor } from "../utils/participant";

type Props = {
  myParticipant: Participant | undefined;
  participants: Participant[];
  draftName: string;
  onDraftNameChange: (name: string) => void;
  onDraftNameBlur: () => void;
  onSaveName: () => void;
  nameChanged: boolean;
};

export function Sidebar({
  myParticipant,
  participants,
  draftName,
  onDraftNameChange,
  onDraftNameBlur,
  onSaveName,
  nameChanged,
}: Props) {
  return (
    <aside className="people">
      {myParticipant ? (
        <div className="name-editor-wrap">
          <span className="name-editor-label">あなたの表示名</span>
          <div className="name-editor">
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
      {participants.length > 0 && <p className="people-subheader">メンバー</p>}
      {participants.map((participant) => (
        <div key={participant.id} className="person">
          <div
            className="person-avatar"
            style={{ "--participant-color": participantColor(participant.id) } as React.CSSProperties & Record<"--participant-color", string>}
          >
            {participant.name.charAt(0)}
          </div>
          <span>{participant.name}</span>
          {participant.isHost ? <strong className="host-badge">Host</strong> : null}
        </div>
      ))}
    </aside>
  );
}
