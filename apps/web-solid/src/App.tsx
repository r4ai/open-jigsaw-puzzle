import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";

const HomeRoute = lazy(() => import("./routes/HomeRoute"));
const RoomRoute = lazy(() => import("./routes/RoomRoute"));

export const App = () => {
  return (
    <Router>
      <Route path="/" component={HomeRoute} />
      <Route path="/rooms/:roomId" component={RoomRoute} />
    </Router>
  );
};
