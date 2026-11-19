import { createHash, randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const issuer = "http://localhost:8180/realms/sagapay";
const clientId = "sagapay-frontend";

export async function signIn(
  page: Page,
  baseURL: string,
  username: "julien" | "gina",
): Promise<string> {
  const passwordVariable = `${username.toUpperCase()}_PASSWORD`;
  const password = process.env[passwordVariable];
  if (!password)
    throw new Error(`Set ${passwordVariable} for the browser stack`);

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");
  const callback = new URL("/auth/callback", baseURL);
  const authorization = new URL(`${issuer}/protocol/openid-connect/auth`);
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback.href,
    response_type: "code",
    scope: "openid",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  await page.goto(authorization.href);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(
      (url) =>
        url.origin === callback.origin && url.pathname === callback.pathname,
    ),
    page.getByRole("button", { name: "Sign In", exact: true }).click(),
  ]);

  const redirect = new URL(page.url());
  expect(redirect.searchParams.get("state")).toBe(state);
  const code = redirect.searchParams.get("code");
  if (!code) throw new Error("Keycloak did not return an authorization code");

  const response = await page.request.post(
    `${issuer}/protocol/openid-connect/token`,
    {
      form: {
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: callback.href,
        code,
        code_verifier: verifier,
      },
    },
  );
  expect(response.status()).toBe(200);
  const token: unknown = await response.json();
  if (
    typeof token !== "object" ||
    token === null ||
    !("access_token" in token) ||
    typeof token.access_token !== "string" ||
    !token.access_token
  ) {
    throw new Error("Keycloak did not return an access token");
  }
  return token.access_token;
}
