import { UserManager } from "oidc-client-ts";

const issuer = "http://localhost:8180/realms/sagapay";
const clientId = "sagapay-frontend";

export function createOidcClient(origin: string): UserManager {
  return new UserManager({
    authority: issuer,
    client_id: clientId,
    redirect_uri: `${origin}/auth/callback`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: "code",
    scope: "openid profile",
    automaticSilentRenew: true,
  });
}
