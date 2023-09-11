import { error, type RequestEvent } from "@sveltejs/kit";
import * as devalue from "devalue";
import type { z, ZodObject } from "zod";
import { SSEHandler } from "./common.js";

export function serveSSE<T, Schema extends ZodObject<any>>(input: {
  event: RequestEvent;
  headers?: Record<string, string>;
  handler: SSEHandler<T, Schema>;
  signal?: AbortSignal;
}) {
  const { event, headers, handler, signal } = input;

  const paramsString = event.url.searchParams.get("params");
  if (!paramsString) throw error(400, `missing input params`);

  let parsedParams: z.infer<Schema>;

  try {
    parsedParams = handler.input.parse(devalue.parse(paramsString));
  } catch (_err) {
    throw error(400, `invalid input params`);
  }

  let streamCancelled = false;
  const ac = new AbortController();

  const stream = new ReadableStream({
    start(controller) {
      async function processGenerator() {
        const stream = handler.generator({
          event,
          signal: ac.signal,
          input: parsedParams,
        });

        for await (const data of stream) {
          if (!streamCancelled) {
            controller.enqueue(`data: ${devalue.stringify(data)}\n\n`);
          }
        }

        if (!streamCancelled) {
          controller.enqueue(`event: system\ndata: end\n\n`);
        }
      }

      processGenerator()
        .catch(() => {
          controller.enqueue(`event: system\ndata: error\n\n`);
        })
        .finally(() => {
          if (!streamCancelled) {
            controller.close();
          }
        });
    },
    cancel() {
      if (!streamCancelled) {
        streamCancelled = true;
        ac.abort();
      }
    },
  });

  signal?.addEventListener("abort", () => {
    if (!streamCancelled) {
      stream.cancel();
    }
  });

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "text/event-stream");

  return new Response(stream, {
    headers: finalHeaders,
  });
}
