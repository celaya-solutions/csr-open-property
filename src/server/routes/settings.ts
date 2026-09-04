import { Hono } from "hono";
import { z } from "zod";
import { query, run } from "../db";
import { jsonBody } from "./shared";

const SettingsInput = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

async function readSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings").catch(() => []);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export const settings = new Hono()
  .get("/", async (c) => c.json({ settings: await readSettings() }))
  .put("/", jsonBody(SettingsInput), async (c) => {
    const entries = Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined && v !== null);
    for (const [key, value] of entries) {
      await run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [key, String(value)],
      );
    }
    return c.json({ settings: await readSettings() });
  });
