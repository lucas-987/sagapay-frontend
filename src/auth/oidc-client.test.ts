import { expect, test } from "vitest";
import { createOidcClient } from "./oidc-client";

test("registers the browser client with Keycloak using the code flow with PKCE and silent renewal", () => {
  const { settings } = createOidcClient("http://localhost:8088");

  expect({
    authority: settings.authority,
    client_id: settings.client_id,
    redirect_uri: settings.redirect_uri,
    post_logout_redirect_uri: settings.post_logout_redirect_uri,
    response_type: settings.response_type,
    scope: settings.scope,
    automaticSilentRenew: settings.automaticSilentRenew,
    disablePKCE: settings.disablePKCE,
  }).toEqual({
    authority: "http://localhost:8180/realms/sagapay",
    client_id: "sagapay-frontend",
    redirect_uri: "http://localhost:8088/auth/callback",
    post_logout_redirect_uri: "http://localhost:8088/",
    response_type: "code",
    scope: "openid profile",
    automaticSilentRenew: true,
    disablePKCE: false,
  });
});
