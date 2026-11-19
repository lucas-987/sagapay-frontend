import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { SessionProvider } from "../auth/session-context";
import type { Application } from "./application";

export function ApplicationProviders({
  application,
  children,
}: {
  application: Application;
  children: ReactNode;
}) {
  return (
    <Provider store={application.store}>
      <SessionProvider adapter={application.adapter}>
        {children}
      </SessionProvider>
    </Provider>
  );
}
