import { gatewayApi } from "../../api/gateway-api";
import type { components } from "../../api/generated/ledger-accounts";
import type { components as transferComponents } from "../../api/generated/transfer";
import type { Transfer, TransferDetail } from "./transfer-logic";

export const transfersPageSize = 20;

export interface TransfersPage {
  items: Transfer[];
  nextCursor: string | undefined;
}

type TransfersResponse = {
  items?: transferComponents["schemas"]["Transfer"][];
  nextCursor?: string | null;
};

type NamesResponse = { items: components["schemas"]["AccountName"][] };

export const transfersApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    getTransfers: build.infiniteQuery<
      TransfersPage,
      undefined,
      string | undefined
    >({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
      query: ({ pageParam }) => ({
        url: "/v1/transfers",
        params: {
          limit: transfersPageSize,
          ...(pageParam === undefined ? {} : { cursor: pageParam }),
        },
      }),
      transformResponse: (response: TransfersResponse): TransfersPage => ({
        items: response.items ?? [],
        nextCursor: response.nextCursor ?? undefined,
      }),
      providesTags: ["Activity"],
    }),
    getTransfer: build.query<TransferDetail, string>({
      query: (id) => `/v1/transfers/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: "Transfer", id }],
    }),
    getNames: build.query<Record<string, string>, readonly string[]>({
      query: (ids) =>
        `/v1/users/names?${new URLSearchParams(ids.map((id) => ["ids", id])).toString()}`,
      transformResponse: (response: NamesResponse) =>
        Object.fromEntries(
          response.items.map(({ accountId, displayName }) => [
            accountId,
            displayName,
          ]),
        ),
      providesTags: ["Names"],
    }),
  }),
});

export const { useGetTransfersInfiniteQuery, useGetTransferQuery } =
  transfersApi;
