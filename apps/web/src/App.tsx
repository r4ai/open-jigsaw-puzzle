import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { HomePage } from "./components/HomePage";
import { WorkspacePage } from "./components/WorkspacePage";

const DEFAULT_NAME = `Player ${Math.floor(Math.random() * 900 + 100)}`;

function getInitialTheme(): "light" | "dark" {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getRoomIdFromPath(pathname: string): string | null {
  const match = /^\/rooms\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

export default function App() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [name, setName] = useState(DEFAULT_NAME);
  const routeRoomId = getRoomIdFromPath(pathname);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Legacy ?room= query param support
  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get("room");
    if (roomId) {
      const normalized = roomId.toUpperCase();
      void navigate({ to: "/rooms/$roomId", params: { roomId: normalized }, replace: true });
    }
  }, [navigate]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  if (!routeRoomId) {
    return (
      <HomePage
        theme={theme}
        name={name}
        onNameChange={setName}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <WorkspacePage
      key={routeRoomId}
      roomId={routeRoomId}
      name={name}
      theme={theme}
      onNameConfirmed={setName}
      onToggleTheme={toggleTheme}
    />
  );
}
