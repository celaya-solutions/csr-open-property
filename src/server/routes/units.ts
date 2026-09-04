import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Unit } from "../../shared/types";

const UnitInput = z.object({
  property_id: z.number().int(),
  name: z.string().min(1),
  bedrooms: z.number().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  sqft: z.number().int().optional().nullable(),
  market_rent: z.number().min(0).optional(),
  status: z.enum(["vacant", "occupied", "turnover", "unavailable"]).optional(),
  notes: z.string().optional().nullable(),
});

const UNIT_SELECT = `
  SELECT u.*,
    p.name as property_name,
    p.color as property_color,
    p.address as property_address,
    p.city as property_city,
    (SELECT l.id FROM leases l WHERE l.unit_id = u.id AND l.status = 'active' ORDER BY l.start_date DESC LIMIT 1) as active_lease_id,
    (SELECT t.first_name || ' ' || t.last_name FROM leases l LEFT JOIN tenants t ON t.id = l.primary_tenant_id WHERE l.unit_id = u.id AND l.status = 'active' ORDER BY l.start_date DESC LIMIT 1) as active_tenant_name
  FROM units u
  LEFT JOIN properties p ON p.id = u.property_id
`;

export const units = new Hono()
  .get("/", async (c) => {
    const propertyId = intParam(c.req.query("property_id"));
    const status = c.req.query("status");
    const where: string[] = [];
    const params: unknown[] = [];
    if (propertyId) { where.push("u.property_id = ?"); params.push(propertyId); }
    if (status) { where.push("u.status = ?"); params.push(status); }
    const sql = `${UNIT_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY p.name, u.name`;
    const rows = await query<Unit>(sql, params);
    return c.json({ units: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<Unit>(`${UNIT_SELECT} WHERE u.id = ?`, [id]);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ unit: row });
  })
  .post("/", jsonBody(UnitInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO units (property_id, name, bedrooms, bathrooms, sqft, market_rent, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.property_id, d.name, d.bedrooms ?? 1, d.bathrooms ?? 1, d.sqft ?? null, d.market_rent ?? 0, d.status ?? "vacant", d.notes ?? null],
    );
    const row = await get<Unit>(`${UNIT_SELECT} WHERE u.id = ?`, [result.lastInsertRowid]);
    return c.json({ unit: row! }, 201);
  })
  .put("/:id", jsonBody(UnitInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE units SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Unit>(`${UNIT_SELECT} WHERE u.id = ?`, [id]);
    return c.json({ unit: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM units WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
