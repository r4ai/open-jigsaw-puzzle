import { For, Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Link, Moon, Play, Sun } from "lucide-solid";
import {
  ADVANCED_DIFFICULTIES,
  BASIC_DIFFICULTIES,
  type Difficulty,
} from "@open-jigsaw-puzzle/shared/protocol";
import { apiClient, apiErrorMessage } from "../api/client";
import {
  advancedNote,
  deco,
  difficulty,
  difficultyAdvanced,
  difficultyGroup,
  divider,
  error as errorCls,
  fieldGroup,
  fieldLabel,
  groupLabel,
  heading,
  hero,
  heroContent,
  home,
  joinRow,
  panelHeader,
  panelInner,
  panelWrap,
  pieceA,
  pieceB,
  pieceC,
  primary,
  selected as selectedCls,
  tagline,
  themeToggle,
} from "./HomePage.styles";

type Props = {
  theme: "light" | "dark";
  name: string;
  onNameChange: (name: string) => void;
  onToggleTheme: () => void;
};

export function HomePage(props: Props) {
  const navigate = useNavigate();
  const [diff, setDiff] = createSignal<Difficulty>(96);
  const [joinId, setJoinId] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const isDark = () => props.theme === "dark";

  async function createRoom() {
    setError(null);
    setCreating(true);
    try {
      const { data, error } = await apiClient.POST("/api/rooms", {
        body: { difficulty: diff() },
      });
      if (!data) {
        setError(apiErrorMessage(error, "部屋を作成できませんでした"));
        return;
      }
      navigate(`/rooms/${data.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main class={home}>
      <section class={hero}>
        <svg class={deco} viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <g class={pieceA}>
            <path d="M 0 0 L 100 0 L 100 35 C 115 35 120 42 120 50 C 120 58 115 65 100 65 L 100 100 L 65 100 C 65 115 58 120 50 120 C 42 120 35 115 35 100 L 0 100 Z" />
          </g>
          <g class={pieceB}>
            <path d="M 100 0 L 200 0 L 200 100 L 100 100 L 100 65 C 115 65 120 58 120 50 C 120 42 115 35 100 35 Z" />
          </g>
          <g class={pieceC}>
            <path d="M 0 100 L 35 100 C 35 115 42 120 50 120 C 58 120 65 115 65 100 L 100 100 L 100 200 L 0 200 Z" />
          </g>
        </svg>

        <div class={heroContent}>
          <h1 class={heading}>
            Open<br />
            <em>Jigsaw</em><br />
            Puzzle
          </h1>
          <p class={tagline}>
            部屋を作って、画像を選ぶ。<br />
            みんなで一緒にパズルを楽しもう。
          </p>
        </div>
      </section>

      <section class={panelWrap} aria-label="部屋の作成と参加">
        <button
          class={themeToggle}
          onClick={props.onToggleTheme}
          title={isDark() ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark() ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div class={panelInner}>
          <p class={panelHeader}>はじめる</p>

          <label>
            表示名
            <input
              value={props.name}
              maxLength={24}
              onInput={(e) => props.onNameChange(e.currentTarget.value)}
            />
          </label>

          <div class={fieldGroup}>
            <p class={fieldLabel}>難易度（ピース数）</p>
            <div class={difficultyGroup}>
              <p class={groupLabel}>基本</p>
              <div class={difficulty} aria-label="基本の難易度">
                <For each={BASIC_DIFFICULTIES}>
                  {(value) => (
                    <button
                      type="button"
                      class={diff() === value ? selectedCls : ""}
                      onClick={() => setDiff(value)}
                    >
                      {value}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <div class={difficultyGroup}>
              <p class={groupLabel}>上級</p>
              <div
                class={`${difficulty} ${difficultyAdvanced}`}
                aria-label="上級の難易度"
              >
                <For each={ADVANCED_DIFFICULTIES}>
                  {(value) => (
                    <button
                      type="button"
                      class={diff() === value ? selectedCls : ""}
                      onClick={() => setDiff(value)}
                    >
                      {value}
                    </button>
                  )}
                </For>
              </div>
              <p class={advancedNote}>※ 端末によっては動作が重くなる場合があります</p>
            </div>
          </div>

          <button
            class={primary}
            onClick={() => void createRoom()}
            disabled={creating()}
          >
            <Play size={16} />
            部屋を作成
          </button>

          <div class={divider}>
            <span>または参加する</span>
          </div>

          <div class={joinRow}>
            <input
              aria-label="部屋ID"
              placeholder="部屋ID を入力"
              value={joinId()}
              onInput={(e) => setJoinId(e.currentTarget.value.toUpperCase())}
            />
            <button
              onClick={() => navigate(`/rooms/${joinId().trim().toUpperCase()}`)}
              disabled={!joinId().trim()}
            >
              <Link size={16} />
              参加
            </button>
          </div>

          <Show when={error()}>
            <p class={errorCls}>{error()}</p>
          </Show>
        </div>
      </section>
    </main>
  );
}
