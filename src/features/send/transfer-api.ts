import { gatewayApi } from "../../api/gateway-api";
import type { Transfer } from "../activity";
import type { TransferIntent } from "./transfer-intent";

export const sendApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    createTransfer: build.mutation<Transfer, TransferIntent>({
      query: ({ key, payload }) => ({
        url: "/v1/transfers",
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: payload,
      }),
      invalidatesTags: ["Wallet", "Activity"],
    }),
  }),
});

export const { useCreateTransferMutation } = sendApi;
