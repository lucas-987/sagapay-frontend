import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { appRoutes } from "./app/app-routes";
import { RootErrorBoundary } from "./app/root-error-boundary";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("SagaPay root is missing");
}

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <RouterProvider router={createBrowserRouter(appRoutes)} />
    </RootErrorBoundary>
  </StrictMode>,
);
