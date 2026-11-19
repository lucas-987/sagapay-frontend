import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthAdapter, SessionState } from "./auth-adapter";

const SessionContext = createContext<AuthAdapter | null>(null);

export function SessionProvider({
  adapter,
  children,
}: {
  adapter: AuthAdapter;
  children: ReactNode;
}) {
  return <SessionContext value={adapter}>{children}</SessionContext>;
}

export function useSession(): {
  state: SessionState;
  signIn: AuthAdapter["signIn"];
  completeSignIn: AuthAdapter["completeSignIn"];
  signOut: AuthAdapter["signOut"];
} {
  const adapter = useContext(SessionContext);
  if (adapter === null) {
    throw new Error("useSession needs a SessionProvider.");
  }
  const state = useSyncExternalStore(adapter.onChange, adapter.getState);
  return {
    state,
    signIn: adapter.signIn,
    completeSignIn: adapter.completeSignIn,
    signOut: adapter.signOut,
  };
}
