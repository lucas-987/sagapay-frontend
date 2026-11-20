import { http, HttpResponse } from "msw";
import { server } from "./setup";

export const customer = "julien-id";
export const olivia = "00000000-0000-4000-a000-000000000001";
export const noah = "00000000-0000-4000-a000-000000000002";
export const emma = "00000000-0000-4000-a000-000000000003";

export interface TransferFixture {
  id: string;
  senderId?: string;
  recipientId?: string;
  amount?: string;
  status?: string;
  createdAt?: string;
  note?: string;
}

export function transferBody({
  id,
  senderId = customer,
  recipientId = olivia,
  amount = "10.00",
  status = "POSTED",
  createdAt = "2026-11-12T12:00:00Z",
  note,
}: TransferFixture) {
  return {
    id,
    senderId,
    recipientId,
    amount: { currency: "EUR", amount },
    status,
    createdAt,
    ...(note === undefined ? {} : { note }),
  };
}

export interface Page {
  items: ReturnType<typeof transferBody>[];
  nextCursor: string | null;
}

export function serveTransfers(pages: Record<string, Page>) {
  const requests: { cursor: string | null; limit: string | null }[] = [];
  server.use(
    http.get("*/v1/transfers", ({ request }) => {
      const { searchParams } = new URL(request.url);
      const cursor = searchParams.get("cursor");
      requests.push({ cursor, limit: searchParams.get("limit") });
      const page = pages[cursor ?? ""];
      return page === undefined
        ? new HttpResponse(null, { status: 400 })
        : HttpResponse.json(page);
    }),
  );
  return requests;
}

export function serveNames(known: Record<string, string>) {
  const requests: string[][] = [];
  server.use(
    http.get("*/v1/users/names", ({ request }) => {
      const ids = new URL(request.url).searchParams.getAll("ids");
      requests.push(ids);
      return HttpResponse.json({
        items: ids
          .filter((id) => id in known)
          .map((id) => ({ accountId: id, displayName: known[id] })),
      });
    }),
  );
  return requests;
}
