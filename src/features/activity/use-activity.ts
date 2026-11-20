import { useSearchParams } from "react-router";
import type { ApiError } from "../../api/api-error";
import type {
  TransferDetailView,
  TransferDrawerContent,
} from "./transfer-drawer";
import type { TransferListState } from "./transfer-list";
import { useCounterpartyNames } from "./use-counterparty-names";
import {
  avatarColorOf,
  counterpartyOf,
  describeFailure,
  describeStep,
  directionOf,
  formatDate,
  formatDateTime,
  initialsOf,
  signedAmount,
  statusLabel,
  statusTone,
  type TransferDetail,
} from "./transfer-logic";
import {
  useGetTransferQuery,
  useGetTransfersInfiniteQuery,
} from "./transfers-api";

const transferParam = "transfer";

function isNotFound(error: unknown): boolean {
  const failure = error as Partial<ApiError> | undefined;
  return (
    (failure?.kind === "problem" || failure?.kind === "unexpected") &&
    failure.status === 404
  );
}

function detailView(
  transfer: TransferDetail,
  customerId: string,
  names: Readonly<Record<string, string>>,
): TransferDetailView {
  const direction = directionOf(transfer, customerId);
  const other = counterpartyOf(transfer, customerId, names);
  return {
    headline: signedAmount(direction, transfer.amount),
    party: `${direction === "sent" ? "Sent to" : "Received from"} ${other.name}`,
    statusLabel: statusLabel(transfer.status),
    statusTone: statusTone(transfer.status),
    id: transfer.id,
    date: formatDateTime(transfer.createdAt),
    note: transfer.note,
    failure:
      transfer.failureReason === null || transfer.failureReason === undefined
        ? undefined
        : describeFailure(transfer.failureReason),
    steps: (transfer.steps ?? []).map((step) => {
      const { title, result } = describeStep(step);
      const when = step.at === undefined ? "" : formatDateTime(step.at);
      return {
        title,
        detail: [when, result].filter((part) => part !== "").join(" · "),
      };
    }),
  };
}

export function useActivity(customerId: string): {
  list: TransferListState;
  drawer: TransferDrawerContent | undefined;
  close: () => void;
} {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(transferParam);
  const query = useGetTransfersInfiniteQuery(undefined);
  const detail = useGetTransferQuery(selectedId ?? "", {
    skip: selectedId === null,
  });
  const transfers = (query.data?.pages ?? []).flatMap((page) => page.items);
  const names = useCounterpartyNames([
    ...transfers.map((transfer) => counterpartyOf(transfer, customerId, {}).id),
    detail.currentData === undefined
      ? undefined
      : counterpartyOf(detail.currentData, customerId, {}).id,
  ]);

  const loadNextPage = () => {
    void query.fetchNextPage();
  };

  let list: TransferListState;
  if (query.data === undefined) {
    list = query.isError
      ? {
          status: "error",
          onRetry: () => {
            void query.refetch();
          },
        }
      : { status: "pending" };
  } else {
    list = {
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
        ? { kind: "failed", onRetry: loadNextPage }
        : query.isFetchingNextPage
          ? { kind: "loading" }
          : query.hasNextPage
            ? { kind: "available", onLoadMore: loadNextPage }
            : { kind: "none" },
      onOpen: (id) => {
        setParams((current) => {
          const next = new URLSearchParams(current);
          next.set(transferParam, id);
          return next;
        });
      },
    };
  }

  let drawer: TransferDrawerContent | undefined;
  if (selectedId !== null) {
    if (detail.currentData !== undefined) {
      drawer = {
        status: "loaded",
        detail: detailView(detail.currentData, customerId, names),
      };
    } else if (detail.isError) {
      drawer = isNotFound(detail.error)
        ? { status: "not-found" }
        : {
            status: "error",
            onRetry: () => {
              void detail.refetch();
            },
          };
    } else {
      drawer = { status: "pending" };
    }
  }

  return {
    list,
    drawer,
    close: () => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete(transferParam);
        return next;
      });
    },
  };
}
