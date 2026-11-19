import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { describe, expect, test } from "vitest";
import { type ApiError, mapFetchError } from "./api-error";

describe("mapFetchError", () => {
  test.each<[string, FetchBaseQueryError, ApiError]>([
    [
      "a problem with a code",
      {
        status: 409,
        data: {
          type: "about:blank",
          title: "Conflict",
          status: 409,
          code: "IDEMPOTENCY_KEY_REUSED",
        },
      },
      { kind: "problem", code: "IDEMPOTENCY_KEY_REUSED", status: 409 },
    ],
    [
      "a problem with a code on a server error",
      { status: 503, data: { status: 503, code: "LEDGER_UNAVAILABLE" } },
      { kind: "problem", code: "LEDGER_UNAVAILABLE", status: 503 },
    ],
    [
      "a problem without a code",
      { status: 400, data: { title: "Bad Request", status: 400 } },
      { kind: "unexpected", status: 400 },
    ],
    [
      "a problem whose code is not text",
      { status: 400, data: { code: 42 } },
      { kind: "unexpected", status: 400 },
    ],
    [
      "a problem whose code is empty",
      { status: 400, data: { code: "" } },
      { kind: "unexpected", status: 400 },
    ],
    [
      "a JSON body that is not an object",
      { status: 500, data: ["boom"] },
      { kind: "unexpected", status: 500 },
    ],
    [
      "a 502 with a null body",
      { status: 502, data: null },
      { kind: "uncertain" },
    ],
    [
      "a 504 without a problem code",
      { status: 504, data: { title: "Gateway Timeout" } },
      { kind: "uncertain" },
    ],
    [
      "a 502 carrying a problem code",
      { status: 502, data: { code: "UPSTREAM_FAILED" } },
      { kind: "problem", code: "UPSTREAM_FAILED", status: 502 },
    ],
    [
      "a 503 without a problem code",
      { status: 503, data: null },
      { kind: "unexpected", status: 503 },
    ],
    [
      "a null body",
      { status: 500, data: null },
      { kind: "unexpected", status: 500 },
    ],
    [
      "a 401 with an empty body",
      { status: 401, data: null },
      { kind: "unauthenticated" },
    ],
    [
      "a 401 carrying a problem",
      { status: 401, data: { code: "TOKEN_EXPIRED" } },
      { kind: "unauthenticated" },
    ],
    [
      "a 401 with a body that is not JSON",
      {
        status: "PARSING_ERROR",
        originalStatus: 401,
        data: "<html>",
        error: "Unexpected token",
      },
      { kind: "unauthenticated" },
    ],
    [
      "a network error",
      { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" },
      { kind: "uncertain" },
    ],
    [
      "a timeout",
      { status: "TIMEOUT_ERROR", error: "AbortError" },
      { kind: "uncertain" },
    ],
    [
      "a body that is not JSON",
      {
        status: "PARSING_ERROR",
        originalStatus: 500,
        data: "<html>Error</html>",
        error: "Unexpected token",
      },
      { kind: "unexpected", status: 500 },
    ],
    [
      "a 502 with a body that is not JSON",
      {
        status: "PARSING_ERROR",
        originalStatus: 502,
        data: "<html>Bad gateway</html>",
        error: "Unexpected token",
      },
      { kind: "uncertain" },
    ],
    [
      "a 504 with a body that is not JSON",
      {
        status: "PARSING_ERROR",
        originalStatus: 504,
        data: "<html>Timeout</html>",
        error: "Unexpected token",
      },
      { kind: "uncertain" },
    ],
    [
      "a custom error",
      { status: "CUSTOM_ERROR", error: "boom" },
      { kind: "unexpected", status: undefined },
    ],
  ])("maps %s", (_name, error, expected) => {
    expect(mapFetchError(error)).toStrictEqual(expected);
  });
});
