import { render } from "@testing-library/react";
import { createMemoryRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { appRoutes } from "../app/app-routes";
import { createApplication } from "../app/application";
import { ApplicationProviders } from "../app/application-providers";
import { fakeOidcClient, userOf } from "./fake-oidc-client";

export const julien = userOf({ subject: "julien-id", name: "Julien Simon" });

export async function renderApp(
  path: string,
  {
    fake = fakeOidcClient(julien),
    routes = appRoutes,
  }: { fake?: ReturnType<typeof fakeOidcClient>; routes?: RouteObject[] } = {},
) {
  const application = createApplication(fake.client);
  await application.ready;
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <ApplicationProviders application={application}>
      <RouterProvider router={router} />
    </ApplicationProviders>,
  );
  return { ...view, router, application, fake };
}
