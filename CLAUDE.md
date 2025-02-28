# MURO Project Guide

## Commands
- **Run Development**: `bun index.ts` or `bun run index.ts`
- **Run Playground**: `cd playground && bun index.ts`
- **Type Check**: `bun tsc --noEmit`
- **Database**:
  - Generate migrations: `bun drizzle-kit generate:sqlite`
  - Run migrations: `bun drizzle-kit push:sqlite`

## Code Style
- **TypeScript**: Use strict typing; avoid `any` when possible
- **Imports**: Sort imports by external, then internal dependencies
- **Error Handling**: Use explicit error objects with messages
- **Naming**:
  - camelCase for variables, functions
  - PascalCase for classes, types, interfaces
  - Descriptive names preferred over abbreviations
- **Types**: Define meaningful type aliases instead of repeating complex types
- **Functions**: Prefer async/await for asynchronous operations
- **Formatting**: 2-space indentation, semicolons required

## Architecture
- Layered approach with strong typing (using Zod for schema validation)
- Database access via Drizzle ORM with SQLite
- Promise-based data fetching patterns