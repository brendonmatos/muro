# Muro
GraphQL for the Back-end. Fully customizable ORM that can be resolved to anything.
Muro is a small TypeScript library for building composable data fetching layers.

Layers validate their input using **zod** and allow callers to select which
fields to resolve via an "include" object. Promises are only awaited when the
corresponding field is explicitly included, letting applications avoid unneeded
data fetching.

The library also provides **PromiseBatch** for batching and deduplicating
concurrent asynchronous tasks.

## Features

- **defineLayer** – create strongly typed resolvers with input validation.
- **Include system** – choose fields to include/exclude, with nested selection.
- **PromiseBatch** – limit concurrency and deduplicate identical requests.
- **Playground** – sample scripts showing usage with a SQLite database via
  Drizzle ORM.

## Example

```ts
import { defineLayer } from "muro";
import { z } from "zod";

const person = defineLayer({
  input: z.object({ id: z.string() }),
  resolver: async (ctx) => ({
    name: "John Doe",
    age: 20,
  }),
});

const book = defineLayer({
  input: z.object({ id: z.string() }),
  resolver: async () => ({
    title: "The Great Gatsby",
    author: person.withInput({ id: "1" }),
  }),
});

// Only include the nested author object when requested
const result = await book.withInput({ id: "1" }, { author: true });
```

## Development

- **Run tests:** `bun test`
- **Type check:** `bun tsc --noEmit`
- **Run playground:** `cd playground && bun simple.ts`

See `CLAUDE.md` for additional notes on architecture and coding style.

