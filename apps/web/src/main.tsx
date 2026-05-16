import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRoute, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import App from "./App";
import "./styles.css";

const rootRoute = createRootRoute({
  component: App,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
});

const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rooms/$roomId",
});

const routeTree = rootRoute.addChildren([indexRoute, roomRoute]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
