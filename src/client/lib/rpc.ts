import { hc } from "hono/client";
import type { ClientResponse } from "hono/client";
import type { AppType } from "../../server/index";

// Relative base: Vite proxies /api in development, and in production the
// rewrite in vercel.json points /api at the Railway server.
export const rpc = hc<AppType>("/");

/**
 * Await a Hono RPC call and return its body, throwing the server's error
 * message on a non-2xx. `T` is the success shape, which each caller pins with
 * `InferResponseType<typeof call, 200>` so error branches stay out of the
 * component types.
 */
export async function unwrap<T>(call: Promise<ClientResponse<unknown>>): Promise<T> {
  const res = await call;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
