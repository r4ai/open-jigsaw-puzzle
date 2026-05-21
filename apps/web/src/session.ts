import { createSignal } from "solid-js";

const DEFAULT_NAME = `Player ${Math.floor(Math.random() * 900 + 100)}`;

// アプリ全体で表示名を共有するための単一のシグナル。Route 跨ぎで保持される。
export const [sessionName, setSessionName] = createSignal(DEFAULT_NAME);
