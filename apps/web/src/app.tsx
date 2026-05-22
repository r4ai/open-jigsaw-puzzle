import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";

const HomeRoute = lazy(() => import("./routes/home-route"));
const RoomRoute = lazy(() => import("./routes/room-route"));

export const App = () => {
  return (
    <Router>
      <Route path="/" component={HomeRoute} />
      <Route path="/rooms/:roomId" component={RoomRoute} />
    </Router>
  );
};
