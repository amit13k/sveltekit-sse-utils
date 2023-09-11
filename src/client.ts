import * as devalue from "devalue";
import { createUnboundedAsyncChannel } from "unbounded-async-channel";
import { ExtractGeneratorValueType, InferSSEHandler } from "./common.js";

export function sseStream<T>(
  url: string,
  options: EventSourceInit & {
    input: Zod.infer<InferSSEHandler<T>["input"]>;
    signal?: AbortSignal;
  },
): AsyncIterable<ExtractGeneratorValueType<T>> {
  type StreamValueType = ExtractGeneratorValueType<T>;

  const { input, signal } = options;

  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set("params", devalue.stringify(input));

  const eventSource = new EventSource(urlObj.toString(), {
    withCredentials: options.withCredentials,
  });

  async function closeAllAndCleanup(err?: Error) {
    channel.close(err);
    eventSource.close();
  }

  eventSource.onerror = () => {
    closeAllAndCleanup(new Error("eventSource.onerror"));
  };

  const channel = createUnboundedAsyncChannel<StreamValueType>();

  eventSource.onmessage = (event: MessageEvent) => {
    let parsed: StreamValueType;
    try {
      parsed = devalue.parse(event.data);
      channel.write(parsed);
    } catch (err) {
      closeAllAndCleanup(
        new Error("eventSource.onmessage: error parsing data"),
      );
    }
  };

  eventSource.addEventListener("system", (e) => {
    if (e.data === "end") {
      void closeAllAndCleanup();
    }

    if (e.data === "error") {
      closeAllAndCleanup(
        new Error("eventSource system message: generator error"),
      );
    }
  });

  signal?.addEventListener("abort", () => {
    closeAllAndCleanup(new Error("aborted from client side"));
  });

  return channel;
}
