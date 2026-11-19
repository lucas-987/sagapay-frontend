import { User } from "oidc-client-ts";
import { vi } from "vitest";
import type { OidcClient } from "../auth/auth-adapter";

const farFuture = 4_102_444_800;

export function userOf({
  subject,
  name,
  token = `token-of-${subject}`,
  state,
  expiresAt = farFuture,
}: {
  subject: string;
  name?: string;
  token?: string;
  state?: unknown;
  expiresAt?: number;
}): User {
  return new User({
    access_token: token,
    token_type: "Bearer",
    session_state: null,
    profile: {
      sub: subject,
      iss: "http://localhost:8180/realms/sagapay",
      aud: "sagapay-frontend",
      exp: expiresAt,
      iat: 0,
      ...(name === undefined ? {} : { name }),
    },
    expires_at: expiresAt,
    userState: state,
  });
}

export function fakeOidcClient(stored: User | null = null) {
  let current = stored;
  const loaded: ((user: User) => void)[] = [];
  const expired: (() => void)[] = [];
  const renewalFailed: (() => void)[] = [];

  const client = {
    getUser: vi.fn(() => Promise.resolve(current)),
    signinRedirect: vi.fn<OidcClient["signinRedirect"]>(() =>
      Promise.resolve(),
    ),
    signinCallback: vi.fn<OidcClient["signinCallback"]>(() =>
      Promise.resolve(undefined),
    ),
    signoutRedirect: vi.fn(() => {
      current = null;
      return Promise.resolve();
    }),
    removeUser: vi.fn(() => {
      current = null;
      return Promise.resolve();
    }),
    events: {
      addUserLoaded: (callback: (user: User) => void) => {
        loaded.push(callback);
      },
      addAccessTokenExpired: (callback: () => void) => {
        expired.push(callback);
      },
      addSilentRenewError: (callback: () => void) => {
        renewalFailed.push(callback);
      },
    },
  } satisfies OidcClient;

  return {
    client,
    load(user: User) {
      current = user;
      loaded.forEach((callback) => {
        callback(user);
      });
    },
    expire() {
      expired.forEach((callback) => {
        callback();
      });
    },
    failRenewal() {
      renewalFailed.forEach((callback) => {
        callback();
      });
    },
  };
}
