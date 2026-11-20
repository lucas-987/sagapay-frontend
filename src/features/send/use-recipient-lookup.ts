import { normaliseHandle } from "./handle";
import { useLookupRecipientQuery, type Recipient } from "./recipient-api";
import { useDebouncedValue } from "./use-debounced-value";

export const lookupDebounceMs = 300;

export type RecipientLookup =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; recipient: Recipient }
  | { status: "not-found" }
  | { status: "failed"; retry: () => void };

export function useRecipientLookup(typed: string): RecipientLookup {
  const handle = normaliseHandle(typed);
  const settled = useDebouncedValue(handle, lookupDebounceMs);
  const query = useLookupRecipientQuery(settled, { skip: settled === "" });

  if (handle === "") return { status: "idle" };
  if (handle !== settled || query.isFetching || query.isUninitialized) {
    return { status: "searching" };
  }
  if (query.currentData !== undefined) {
    return { status: "found", recipient: query.currentData };
  }
  const { error } = query;
  return error !== undefined &&
    "kind" in error &&
    error.kind === "problem" &&
    error.code === "RECIPIENT_NOT_FOUND"
    ? { status: "not-found" }
    : {
        status: "failed",
        retry: () => {
          void query.refetch();
        },
      };
}
