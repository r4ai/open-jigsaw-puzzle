import { useParams } from "@solidjs/router";
import { createSignal } from "solid-js";
import { WorkspacePage } from "../components/workspace-page";
import { getInitialTheme, setTheme as applyTheme } from "../theme";
import { sessionName, setSessionName } from "../session";

export default function RoomRoute() {
  const params = useParams<{ roomId: string }>();
  const [theme, setTheme] = createSignal(getInitialTheme());

  function toggleTheme() {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <WorkspacePage
      roomId={params.roomId}
      name={sessionName()}
      theme={theme()}
      onNameConfirmed={setSessionName}
      onToggleTheme={toggleTheme}
    />
  );
}
