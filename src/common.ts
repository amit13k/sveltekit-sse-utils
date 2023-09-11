import { RequestEvent } from "@sveltejs/kit";
import { ZodObject, z } from "zod";

export type InferSSEHandler<R> = R extends SSEHandler<infer T, infer Input>
  ? SSEHandler<T, Input>
  : never;

type SSEGenerator<T, Schema extends ZodObject<any>> = (params: {
  event: RequestEvent;
  signal: AbortSignal;
  input: z.infer<Schema>;
}) => AsyncIterable<T>;

export type SSEHandler<T, Schema extends ZodObject<any>> = {
  input: Schema;
  generator: SSEGenerator<T, Schema>;
};

export function createSSEHandler<T, Schema extends ZodObject<any>>(
  generator: SSEGenerator<T, Schema>,
  input: Schema,
): SSEHandler<T, Schema> {
  return {
    generator,
    input,
  };
}

/* eslint-disable */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ExtractGeneratorValueType<T> = T extends SSEHandler<
  infer U,
  infer _
>
  ? U
  : never;
/* eslint-enable */
