import { Navigate, type NonIndexRouteObject } from "react-router";
import { ActivityPage } from "../features/activity";
import { SendMoneyPage } from "../features/send";
import { ApplicationFailure, PageNotFound, RouteFailure } from "./error-pages";
import { Layout } from "./layout";

export const appRoutes: NonIndexRouteObject[] = [
  {
    path: "/",
    Component: Layout,
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
