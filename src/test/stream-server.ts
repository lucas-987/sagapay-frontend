import { http, HttpResponse } from "msw";
import { server } from "./setup";

export interface StreamConnection {
  authorization: string | null;
  accept: string | null;
  aborted: boolean;
  push(event: string, data: unknown, id?: string): void;
  comment(text: string): void;
  close(): void;
  cut(): void;
}

const encoder = new TextEncoder();

export function serveStream(answer: (attempt: number) => number = () => 200) {
  const connections: StreamConnection[] = [];
  server.use(
    http.get("*/v1/stream/activity", ({ request }) => {
      const attempt = connections.length;
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const connection: StreamConnection = {
        authorization: request.headers.get("authorization"),
        accept: request.headers.get("accept"),
        aborted: false,
        push(event, data, id = crypto.randomUUID()) {
          controller.enqueue(
            encoder.encode(
              `id: ${id}\nevent: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`,
            ),
          );
        },
        comment(text) {
          controller.enqueue(encoder.encode(`: ${text}\n\n`));
        },
        close: () => {
          controller.close();
        },
        cut: () => {
          controller.error(new TypeError("network error"));
        },
      };
      connections.push(connection);
      request.signal.addEventListener("abort", () => {
        connection.aborted = true;
      });
      const status = answer(attempt);
      if (status !== 200) {
        return new HttpResponse(null, { status });
      }
      const body = new ReadableStream<Uint8Array>({
        start(started) {
          controller = started;
          started.enqueue(encoder.encode(": open\n\n"));
        },
      });
      return new HttpResponse(body, {
        headers: { "content-type": "text/event-stream" },
      });
    }),
  );
  return { connections };
}
