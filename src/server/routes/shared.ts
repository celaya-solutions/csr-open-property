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

export function buildUpdate(fields: Record<string, unknown>): { sets: string[]; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { sets.push(`${k} = ?`); params.push(v); }
  }
  return { sets, params };
}
