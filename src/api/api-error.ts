import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export type ApiError =
  | { kind: "uncertain" }
  | { kind: "unauthenticated" }
  | { kind: "problem"; code: string; status: number }
  | { kind: "unexpected"; status: number | undefined };

function problemCode(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }
  return typeof data.code === "string" && data.code !== ""
    ? data.code
    : undefined;
}

// A gateway or proxy answers these when the backend may have processed the
// request: the outcome is unknown, like a lost connection.
function isGatewayFailure(status: unknown): boolean {
  return status === 502 || status === 504;
}

export function mapFetchError(error: FetchBaseQueryError): ApiError {
  switch (error.status) {
    case "FETCH_ERROR":
    case "TIMEOUT_ERROR":
      return { kind: "uncertain" };
    case "PARSING_ERROR":
      if (error.originalStatus === 401) return { kind: "unauthenticated" };
      return isGatewayFailure(error.originalStatus)
        ? { kind: "uncertain" }
        : { kind: "unexpected", status: error.originalStatus };
    case "CUSTOM_ERROR":
      return { kind: "unexpected", status: undefined };
    case 401:
      return { kind: "unauthenticated" };
    default: {
      const code = problemCode(error.data);
      if (code !== undefined) {
        return { kind: "problem", code, status: error.status };
      }
      return isGatewayFailure(error.status)
        ? { kind: "uncertain" }
        : { kind: "unexpected", status: error.status };
    }
  }
}
