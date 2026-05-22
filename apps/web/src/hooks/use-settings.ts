import { createEffect, createSignal } from "solid-js";

export type PieceEdgeSettings = {
  edgeOpacityLocked: number;
  edgeOpacityUnlocked: number;
  edgeOpacitySelected: number;
};

const STORAGE_KEY = "open-puzzle:settings:v1";

export const DEFAULT_SETTINGS: PieceEdgeSettings = {
  edgeOpacityLocked: 0.18,
  edgeOpacityUnlocked: 0.65,
  edgeOpacitySelected: 0.7,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function loadSettings(): PieceEdgeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PieceEdgeSettings>;
    return {
      edgeOpacityLocked: clamp01(parsed.edgeOpacityLocked ?? DEFAULT_SETTINGS.edgeOpacityLocked),
      edgeOpacityUnlocked: clamp01(parsed.edgeOpacityUnlocked ?? DEFAULT_SETTINGS.edgeOpacityUnlocked),
      edgeOpacitySelected: clamp01(parsed.edgeOpacitySelected ?? DEFAULT_SETTINGS.edgeOpacitySelected),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Loads piece-edge display settings from localStorage and persists changes.
 */
export function useSettings() {
  const [settings, setSettings] = createSignal<PieceEdgeSettings>(loadSettings());

  createEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    } catch {
      /* ignore quota errors */
    }
  });

  function update<K extends keyof PieceEdgeSettings>(key: K, value: number) {
    setSettings((prev) => ({ ...prev, [key]: clamp01(value) }));
  }

  function reset() {
    setSettings(DEFAULT_SETTINGS);
  }

  return { settings, update, reset };
}
