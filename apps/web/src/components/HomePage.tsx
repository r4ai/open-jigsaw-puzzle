import { Link, Moon, Play, Sun } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@open-puzzle/shared/protocol";
import { apiClient, apiErrorMessage } from "../api/client";
import styles from "./HomePage.module.css";

type Props = {
  theme: "light" | "dark";
  name: string;
  onNameChange: (name: string) => void;
  onToggleTheme: () => void;
};

export function HomePage({ theme, name, onNameChange, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>(96);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const isDark = theme === "dark";

  async function createRoom() {
    setError(null);
    setCreating(true);
    try {
      const { data, error } = await apiClient.POST("/api/rooms", {
        body: { difficulty },
      });
      if (!data) {
        setError(apiErrorMessage(error, "部屋を作成できませんでした"));
        return;
      }
      await navigate({ to: "/rooms/$roomId", params: { roomId: data.room.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className={styles.home}>
      {/* ── Left: dark stage ── */}
      <section className={styles.hero}>
        <svg className={styles.deco} viewBox="0 0 320 300" fill="none" aria-hidden="true">
          <path
            d="M 20 20 L 230 20 L 230 100
               C 258 100 275 108 275 118
               C 275 128 258 136 230 136
               L 230 240 L 130 240
               C 130 268 120 282 108 282
               C 96 282 86 268 86 240
               L 20 240 Z"
            stroke="currentColor" strokeWidth="2"
          />
        </svg>

        <div className={styles.heroContent}>
          <h1 className={styles.heading}>
            Open<br />
            <em>Jigsaw</em><br />
            Puzzle
          </h1>
          <p className={styles.tagline}>
            部屋を作って画像を選ぶだけ。<br />
            みんなで一緒にパズルを楽しもう。
          </p>
        </div>
      </section>

      {/* ── Right: panel ── */}
      <section className={styles.panelWrap} aria-label="部屋の作成と参加">
        <button
          className={styles.themeToggle}
          onClick={onToggleTheme}
          title={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className={styles.panelInner}>
          <p className={styles.panelHeader}>はじめる</p>

          <label>
            表示名
            <input
              value={name}
              maxLength={24}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </label>

          <div className={styles.fieldGroup}>
            <p className={styles.fieldLabel}>難易度（ピース数）</p>
            <div className={styles.difficulty} aria-label="難易度">
              {DIFFICULTIES.map((value) => (
                <button
                  key={value}
                  className={difficulty === value ? styles.selected : ""}
                  onClick={() => setDifficulty(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button className={styles.primary} onClick={() => void createRoom()} disabled={creating}>
            <Play size={16} />
            部屋を作成
          </button>

          <div className={styles.divider}><span>または参加する</span></div>

          <div className={styles.joinRow}>
            <input
              aria-label="部屋ID"
              placeholder="部屋ID を入力"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            />
            <button
              onClick={() => void navigate({ to: "/rooms/$roomId", params: { roomId: joinId.trim().toUpperCase() } })}
              disabled={!joinId.trim()}
            >
              <Link size={16} />
              参加
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
