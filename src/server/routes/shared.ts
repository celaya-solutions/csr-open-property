import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

export const intParam = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Validate a JSON body against a Zod schema. The handler then reads the parsed
 * value with `c.req.valid("json")`, and the client gets the body's type for
 * free from the route definition.
 */
export const jsonBody = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return c.json({ error: message || "Invalid body" }, 400);
    }
  });

/**
 * Drop the keys a PATCH body left out, so `.set()` only touches what was sent.
 * Returns null when nothing is left to write.
 */
export function definedFields<T extends Record<string, unknown>>(fields: T): Partial<T> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? (out as Partial<T>) : null;
}
