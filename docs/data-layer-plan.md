# Data layer plan — TanStack Query + Hono RPC

Two changes, one branch. Nothing about the UI, the schema, or the deploy shape
moves.

## Why

`use-app-state.ts` held every list in `useState` and refetched whole collections
after each mutation, so there was no cache, no optimistic update, and no way for
two screens to share a loaded list. Separately, `src/client/types.ts` hand-wrote
the shapes that `src/server/index.ts` returns, so a renamed column stayed silent
until it hit the screen.

## Step 1 — TanStack Query

- One `QueryClient` at the root, `staleTime` 30s so tab switches are instant.
- `src/client/hooks/queries.ts` holds a key factory and one hook per resource.
- Mutations invalidate the keys they touch instead of calling `refreshLookups()`.
- Pages drop their `useState` + `useEffect` + `load()` triple.
- `useApp()` keeps its shape so the dialogs do not have to change.

## Step 2 — Hono RPC

- Entity types move to `src/shared/types.ts`, imported by both sides.
- `src/server/index.ts` splits into chained route modules under
  `src/server/routes/`, which is what Hono needs to infer an `AppType`.
- `query<T>` / `get<T>` calls get their real row types, so `c.json()` infers.
- The client calls the server through `hc<AppType>()`. Paths, params, and
  response shapes are now checked at compile time.

## Deliberately out of scope

Drizzle, Vitest, TanStack Router, and collapsing the Vercel/Railway split are
steps 3 to 6 of the larger plan and are not in this branch.
