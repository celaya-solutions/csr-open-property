import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { settings as settingsTable } from "../schema";
import { jsonBody } from "./shared";

const SettingsInput = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

async function readSettings(): Promise<Record<string, string>> {
  const rows = await db().select().from(settingsTable).catch(() => []);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export const settings = new Hono()
  .get("/", async (c) => c.json({ settings: await readSettings() }))
  .put("/", jsonBody(SettingsInput), async (c) => {
    const entries = Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined && v !== null);
    for (const [key, value] of entries) {
      await db()
        .insert(settingsTable)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: String(value), updated_at: sql`(datetime('now'))` },
        });
    }
    return c.json({ settings: await readSettings() });
  });
