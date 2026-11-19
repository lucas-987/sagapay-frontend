import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { createApplication } from "./app/application";
import { ApplicationProviders } from "./app/application-providers";
import { appRoutes } from "./app/app-routes";
import { RootErrorBoundary } from "./app/root-error-boundary";
import { createOidcClient } from "./auth/oidc-client";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("SagaPay root is missing");
}

const application = createApplication(createOidcClient(location.origin));

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <ApplicationProviders application={application}>
        <RouterProvider router={createBrowserRouter(appRoutes)} />
      </ApplicationProviders>
    </RootErrorBoundary>
  </StrictMode>,
);
