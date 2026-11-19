import { gatewayApi } from "../../api/gateway-api";
import type { components } from "../../api/generated/ledger-accounts";

export interface Money {
  amount: string;
  currency: string;
}

export interface Wallet {
  balance: Money;
  available: Money;
  held: Money;
}

type WalletResponse = components["schemas"]["Money"];

function moneyOf(money: WalletResponse | undefined): Money {
  if (money?.amount === undefined || money.currency === undefined) {
    throw new Error("The wallet lacks an amount or a currency.");
  }
  return { amount: money.amount, currency: money.currency };
}

export const walletApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    getWallet: build.query<Wallet, undefined>({
      query: () => "/v1/wallet",
      transformResponse: (response: {
        balance?: WalletResponse;
        available?: WalletResponse;
        held?: WalletResponse;
      }) => ({
        balance: moneyOf(response.balance),
        available: moneyOf(response.available),
        held: moneyOf(response.held),
      }),
      providesTags: ["Wallet"],
    }),
  }),
});

export const { useGetWalletQuery } = walletApi;
