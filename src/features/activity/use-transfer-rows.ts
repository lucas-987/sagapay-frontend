import { useCounterpartyNames } from "./use-counterparty-names";
import {
  avatarColorOf,
  counterpartyOf,
  directionOf,
  formatDate,
  initialsOf,
  signedAmount,
  statusLabel,
  statusTone,
} from "./transfer-logic";
import type { TransferListState } from "./transfer-list";
import { useGetTransfersInfiniteQuery } from "./transfers-api";

export function useTransferRows(customerId: string): TransferListState {
  const query = useGetTransfersInfiniteQuery(undefined);
  const transfers = (query.data?.pages ?? []).flatMap((page) => page.items);
  const names = useCounterpartyNames(
    transfers.map((transfer) => counterpartyOf(transfer, customerId, {}).id),
  );

  if (query.data === undefined) {
    return query.isError
      ? {
          status: "error",
          onRetry: () => {
            void query.refetch();
          },
        }
      : { status: "pending" };
  }
  const retryNextPage = () => {
    void query.fetchNextPage();
  };
  return {
    status: "loaded",
    rows: transfers.map((transfer) => {
      const direction = directionOf(transfer, customerId);
      const other = counterpartyOf(transfer, customerId, names);
      return {
        id: transfer.id,
        name: other.name,
        initials: initialsOf(other.name),
        color: avatarColorOf(other.id),
        subtitle: other.subtitle,
        date: formatDate(transfer.createdAt),
        statusLabel: statusLabel(transfer.status),
        statusTone: statusTone(transfer.status),
        amount: signedAmount(direction, transfer.amount),
        received: direction === "received",
      };
    }),
    more: query.isError
      ? { kind: "failed", onRetry: retryNextPage }
      : query.isFetchingNextPage
        ? { kind: "loading" }
        : query.hasNextPage
          ? { kind: "available", onLoadMore: retryNextPage }
          : { kind: "none" },
    onOpen: () => undefined,
  };
}
