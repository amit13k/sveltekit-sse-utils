# Documentation

sveltekit-sse-utils provides utility functions to implement streaming rpc in sveltekit.

## Installation

```
npm i zod devalue sveltekit-sse-utils
```

## Usage in +server.ts

```ts
import { createSSEHandler, serveSSE } from "sveltekit-sse-utils";
import z from "zod";

/**
 * CreateSSEHandler takes an async generator function and a zod schema
 *
 * - The generator function is called with the input from the client as per the
 *   zod schema
 * - It also has accesss to an abort signal which gets aborted when the client
 *   disconnects
 * - The type of value that the generator function yields is inferred from the
 *   type of the return value of the generator function and this can used on the
 *   client side with typescript utilities like ExtractGeneratorValueType
 */
const handler = createSSEHandler(
  async function* ({ event, input, signal }) {
    for (let i = 0; i < 10; i++) {
      yield `sending updates for ${input.name} ${i}`;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  },
  z.object({
    name: z.string(),
  }),
);

/** You can save typeof handler to later use in +page.svelte */
export type UpdatesHandler = typeof handler;

/** ServeSSE needs event and the handler to serve server side events */
export const GET = (event) => serveSSE({ event, handler });
```

## Usage in +page.svelte

```ts
<script lang="ts">
	import { sseStream, type ExtractGeneratorValueType } from 'sveltekit-sse-utils';

	import type { UpdatesHandler } from './api/updates/+server';

	// ExtractGeneratorValueType utility is used to infer the type of the values the generator function yields
	let messages: ExtractGeneratorValueType<UpdatesHandler>[] = [];

	async function getUpdates() {
		const ac = new AbortController();

		/**
		 * sseStream is a function that returns an async iterable
		 * - If we provide typeof handler returned from createSSEHandler we can get typesafety for the input
		 *   object passed to the handler
		 * - We can pass an AbortSignal to abort the stream
		 */
		const stream = sseStream<UpdatesHandler>('/api/updates', {
			input: {
				name: 'SvelteKit'
			},
			signal: ac.signal
		});

		try {
			for await (const data of stream) {
				messages.push(data);
				messages = messages;
			}
		} catch (err) {
			/**
			 * We reach here if,
			 * 1. the connection is closed without properly completing the generator function
			 * 2. an error is thrown inside the generator function
			 * 3. signal passed to sseStream is aborted
			 */
			console.error(err);
		}
	}
</script>

<button on:click={getUpdates}>Get updates</button>

{#each messages as message}
	<p>{message}</p>
{/each}
```
