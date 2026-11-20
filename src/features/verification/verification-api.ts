import { gatewayApi } from "../../api/gateway-api";
import type { components } from "../../api/generated/transfer";

export const verificationApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    confirmTransfer: build.mutation<
      components["schemas"]["Transfer"],
      { id: string; verificationToken: string }
    >({
      query: ({ id, verificationToken }) => ({
        url: `/v1/transfers/${encodeURIComponent(id)}/confirm`,
        method: "POST",
        body: { verificationToken },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Transfer", id },
        "Activity",
      ],
    }),
  }),
});

export const { useConfirmTransferMutation } = verificationApi;
