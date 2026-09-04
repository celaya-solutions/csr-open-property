import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Vendor } from "../../shared/types";

const VendorInput = z.object({
  name: z.string().min(1),
  category: z.enum(["plumber", "electrician", "hvac", "handyman", "cleaning", "landscaping", "general"]).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

export const vendors = new Hono()
  .get("/", async (c) => {
    const rows = await query<Vendor>("SELECT * FROM vendors ORDER BY name");
    return c.json({ vendors: rows });
  })
  .post("/", jsonBody(VendorInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      "INSERT INTO vendors (name, category, phone, email, notes, color) VALUES (?, ?, ?, ?, ?, ?)",
      [d.name, d.category ?? "general", d.phone ?? null, d.email ?? null, d.notes ?? null, d.color ?? "slate"],
    );
    const row = await get<Vendor>("SELECT * FROM vendors WHERE id = ?", [result.lastInsertRowid]);
    return c.json({ vendor: row! }, 201);
  })
  .put("/:id", jsonBody(VendorInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE vendors SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Vendor>("SELECT * FROM vendors WHERE id = ?", [id]);
    return c.json({ vendor: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM vendors WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
