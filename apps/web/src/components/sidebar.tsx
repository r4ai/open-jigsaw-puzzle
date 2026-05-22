import { For, Show } from "solid-js";
import { Check } from "lucide-solid";
import type { Participant } from "@open-jigsaw-puzzle/shared/protocol";
import { participantColor } from "../utils/participant";
import {
  hidden,
  hostBadge,
  memberList,
  nameEditor,
  nameEditorLabel,
  nameEditorWrap,
  people,
  peopleSubheader,
  person,
  personAvatar,
} from "./sidebar.styles";

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

export function Sidebar(props: Props) {
  return (
    <aside class={`${people} ${!props.sidebarOpen ? hidden : ""}`}>
      <Show when={props.myParticipant}>
        <div class={nameEditorWrap}>
          <span class={nameEditorLabel}>あなたの表示名</span>
          <div class={nameEditor}>
            <input
              aria-label="表示名"
              value={props.draftName}
              maxLength={24}
              onInput={(e) => props.onDraftNameChange(e.currentTarget.value)}
              onBlur={props.onDraftNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onSaveName();
              }}
            />
            <button
              type="button"
              disabled={!props.nameChanged}
              title="表示名を保存"
              onClick={props.onSaveName}
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      </Show>
      <div class={memberList}>
        <Show when={props.participants.length > 0}>
          <p class={peopleSubheader}>メンバー</p>
        </Show>
        <For each={props.participants}>
          {(participant) => (
            <div class={person}>
              <div
                class={personAvatar}
                style={{ "--participant-color": participantColor(participant.id) }}
              >
                {participant.name.charAt(0)}
              </div>
              <span>{participant.name}</span>
              <Show when={participant.isHost}>
                <strong class={hostBadge}>Host</strong>
              </Show>
            </div>
          )}
        </For>
      </div>
    </aside>
  );
}
