import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { HomePage } from "../components/home-page";
import { getInitialTheme, setTheme as applyTheme } from "../theme";
import { sessionName, setSessionName } from "../session";

export default function HomeRoute() {
  const navigate = useNavigate();
  const [theme, setTheme] = createSignal(getInitialTheme());

  onMount(() => {
    // Legacy ?room= クエリ吸収
    const params = new URLSearchParams(window.location.search);
    const legacyRoom = params.get("room");
    if (legacyRoom) {
      navigate(`/rooms/${legacyRoom.toUpperCase()}`, { replace: true });
    }
  });

  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <HomePage
      theme={theme()}
      name={sessionName()}
      onNameChange={setSessionName}
      onToggleTheme={toggleTheme}
    />
  );
}
