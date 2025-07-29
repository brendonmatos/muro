# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- **Run Development**: `bun index.ts` or `bun run index.ts`
- **Run Playground**: `cd playground && bun simple.ts` (or `bun db.ts` for database examples)
- **Run Tests**: `bun test`
- **Type Check**: `bun tsc --noEmit`
- **Database**:
  - Generate migrations: `bun drizzle-kit generate:sqlite`
  - Run migrations: `bun drizzle-kit push:sqlite`

## Architecture

MURO is a layer-based data fetching library with type-safe include/exclude patterns, similar to GraphQL but with TypeScript-first design.

### Core Concepts

- **Layer Definition**: Use `defineLayer()` to create reusable data resolvers with Zod input validation
- **Context System**: Each layer resolver receives a context with `input` (validated) and `include` (selection rules)
- **Include System**: Type-safe field selection using recursive include objects to optimize data fetching
- **Promise Chaining**: Layers can reference other layers, creating composable data graphs
- **Concurrency Control**: `PromiseBatch` class provides request batching and concurrency limits

### Layer Pattern
```typescript
const layer = defineLayer({
  input: z.object({ id: z.string() }),
  resolver: async (ctx) => ({
    field1: "value",
    field2: otherLayer.withInput({ id: ctx.input.id })
  })
});
```

### Include System
The include system allows selective field fetching. Fields can be:
- `true`: Include and resolve promises
- `false`: Exclude entirely  
- `{}`: Include with nested selection rules
- Missing: Include primitives, exclude promises

### Database Integration
- Uses Drizzle ORM with SQLite via Bun
- `optionalBasedOnInclude()` helper optimizes SQL SELECT based on include rules
- Database file: `bun.db` (SQLite)

## Code Style
- **TypeScript**: Strict typing enabled; avoid `any` except for complex generic scenarios
- **Imports**: External dependencies first, then internal
- **Error Handling**: Throw explicit Error objects with descriptive messages
- **Naming**: camelCase variables/functions, PascalCase types/classes
- **Formatting**: 2-space indentation, semicolons required
- **Types**: Create meaningful type aliases for complex recursive types