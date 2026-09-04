import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Property } from "../../shared/types";

const PropertyInput = z.object({
  name: z.string().min(1),
  type: z.enum(["single_family", "multi_family", "condo", "townhouse", "commercial"]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  year_built: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

export const properties = new Hono()
  .get("/", async (c) => {
    const rows = await query<Property>(
      `SELECT p.*,
         (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) as unit_count,
         (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id AND u.status = 'occupied') as occupied_count
       FROM properties p ORDER BY p.name`,
    );
    return c.json({ properties: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<Property>("SELECT * FROM properties WHERE id = ?", [id]);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ property: row });
  })
  .post("/", jsonBody(PropertyInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO properties (name, type, address, city, state, zip, year_built, notes, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.name, d.type ?? "single_family", d.address ?? null, d.city ?? null, d.state ?? null, d.zip ?? null, d.year_built ?? null, d.notes ?? null, d.color ?? "sky"],
    );
    const row = await get<Property>("SELECT * FROM properties WHERE id = ?", [result.lastInsertRowid]);
    return c.json({ property: row! }, 201);
  })
  .put("/:id", jsonBody(PropertyInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE properties SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Property>("SELECT * FROM properties WHERE id = ?", [id]);
    return c.json({ property: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM properties WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
