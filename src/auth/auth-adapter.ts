import type { User } from "oidc-client-ts";
import type { SessionPort } from "../api/session";

export interface OidcClient {
  getUser(): Promise<User | null>;
  signinRedirect(args: { state: string }): Promise<void>;
  signinCallback(url: string): Promise<User | undefined>;
  signoutRedirect(): Promise<void>;
  removeUser(): Promise<void>;
  events: {
    addUserLoaded(callback: (user: User) => void): unknown;
    addAccessTokenExpired(callback: () => void): unknown;
    addSilentRenewError(callback: () => void): unknown;
  };
}

export type SessionState =
  | { status: "loading" }
  | { status: "signed-in"; subject: string; displayName: string }
  | { status: "signed-out" }
  | { status: "sign-in-failed" }
  | { status: "signing-out" };

export type SessionEvent = "signed-out" | "user-changed" | "expired";

export interface AuthAdapter extends SessionPort {
  getState: () => SessionState;
  onChange: (listener: () => void) => () => void;
  onEvent: (listener: (event: SessionEvent) => void) => () => void;
  initialize: () => Promise<void>;
  signIn: (returnTo: string) => Promise<void>;
  completeSignIn: (callbackUrl: string) => Promise<string>;
  signOut: () => Promise<void>;
}

const defaultPath = "/activity";
const callbackPath = "/auth/callback";

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\/(?![/\\])[\x20-\x5b\x5d-\x7e]*$/.test(value) ||
    value.startsWith(callbackPath)
  ) {
    return defaultPath;
  }
  return value;
}

export function createAuthAdapter(client: OidcClient): AuthAdapter {
  let state: SessionState = { status: "loading" };
  const changeListeners = new Set<() => void>();
  const eventListeners = new Set<(event: SessionEvent) => void>();
  let callback: { url: string; path: Promise<string> } | undefined;

  const setState = (next: SessionState) => {
    state = next;
    changeListeners.forEach((listener) => {
      listener();
    });
  };
  const emit = (event: SessionEvent) => {
    eventListeners.forEach((listener) => {
      listener(event);
    });
  };
  const signedIn = (user: User): SessionState => ({
    status: "signed-in",
    subject: user.profile.sub,
    displayName: user.profile.name ?? "Customer",
  });

  // The event goes out before the state changes, so that the cache holding
  // the previous customer's data is cleared before any screen shows the next.
  client.events.addUserLoaded((user) => {
    if (state.status === "signed-in" && state.subject !== user.profile.sub) {
      emit("user-changed");
    }
    setState(signedIn(user));
  });
  const expire = () => {
    if (state.status !== "signed-in") return;
    emit("expired");
    setState({ status: "signed-out" });
  };
  client.events.addAccessTokenExpired(expire);
  client.events.addSilentRenewError(expire);

  // A refused callback leaves the customer signed out. The guard must not
  // redirect to Keycloak again, which would answer at once and loop.
  const failSignIn = () => {
    if (state.status !== "signed-in") setState({ status: "sign-in-failed" });
    return defaultPath;
  };

  async function finishSignIn(url: string): Promise<string> {
    try {
      const user = await client.signinCallback(url);
      return user === undefined ? failSignIn() : safeReturnPath(user.state);
    } catch {
      return failSignIn();
    }
  }

  return {
    getState: () => state,
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    async initialize() {
      const user = await client.getUser().catch(() => null);
      const failed = state.status === "sign-in-failed";
      if (state.status !== "loading" && !failed) return;
      if (user !== null && user.expired !== true) {
        setState(signedIn(user));
      } else if (!failed) {
        setState({ status: "signed-out" });
      }
    },
    signIn: (returnTo) => client.signinRedirect({ state: returnTo }),
    completeSignIn(url) {
      if (callback?.url !== url) {
        callback = { url, path: finishSignIn(url) };
      }
      return callback.path;
    },
    async signOut() {
      emit("signed-out");
      setState({ status: "signing-out" });
      try {
        await client.signoutRedirect();
      } catch {
        // Whatever happens to the stored session, this tab no longer holds it.
        await client.removeUser().catch(() => undefined);
        setState({ status: "signed-out" });
      }
    },
    async getAccessToken() {
      const user = await client.getUser();
      return user === null || user.expired === true ? null : user.access_token;
    },
  };
}
