import { gatewayApi } from "../../api/gateway-api";
import type { operations } from "../../api/generated/ledger-accounts";

export interface Recipient {
  accountId: string;
  displayName: string;
  handle: string;
}

type LookupResponse =
  operations["lookupAccount"]["responses"][200]["content"]["application/json"];

export const recipientApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    lookupRecipient: build.query<Recipient, string>({
      query: (handle) => ({ url: "/v1/users/lookup", params: { handle } }),
      transformResponse: (response: LookupResponse, _meta, handle) => {
        if (
          response.accountId === undefined ||
          response.displayName === undefined
        ) {
          throw new Error("The lookup lacks an account id or a display name.");
        }
        return {
          accountId: response.accountId,
          displayName: response.displayName,
          handle,
        };
      },
    }),
  }),
});

export const { useLookupRecipientQuery } = recipientApi;
