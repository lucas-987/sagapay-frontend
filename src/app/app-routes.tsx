import { Navigate, type NonIndexRouteObject } from "react-router";
import { useSession } from "../auth/session-context";
import { ActivityPage } from "../features/activity";
import { SendMoneyPage } from "../features/send";
import { ApplicationFailure, PageNotFound, RouteFailure } from "./error-pages";
import { AuthCallbackPage } from "./auth-callback-page";
import { Layout } from "./layout";
import { RequireSession } from "./require-session";

function GuardedLayout() {
  const { signOut } = useSession();
  return (
    <RequireSession>
      {({ subject, displayName }) => (
        <Layout
          customerId={subject}
          displayName={displayName}
          onSignOut={() => {
            void signOut();
          }}
        />
      )}
    </RequireSession>
  );
}

export const appRoutes: NonIndexRouteObject[] = [
  { path: "/auth/callback", Component: AuthCallbackPage },
  {
    path: "/",
    Component: GuardedLayout,
    ErrorBoundary: ApplicationFailure,
    children: [
      {
        index: true,
        element: <Navigate to="/activity" replace />,
      },
      {
        path: "activity",
        Component: ActivityPage,
        ErrorBoundary: RouteFailure,
      },
      {
        path: "send",
        Component: SendMoneyPage,
        ErrorBoundary: RouteFailure,
      },
      {
        path: "*",
        Component: PageNotFound,
      },
    ],
  },
];
