import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Lease } from "../../shared/types";

const LeaseInput = z.object({
  unit_id: z.number().int(),
  primary_tenant_id: z.number().int().nullable().optional(),
  start_date: z.string(),
  end_date: z.string(),
  monthly_rent: z.number().min(0).optional(),
  deposit: z.number().min(0).optional(),
  rent_due_day: z.number().int().min(1).max(31).optional(),
  late_fee: z.number().min(0).optional(),
  status: z.enum(["upcoming", "active", "ended", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
});

const LEASE_SELECT = `
  SELECT l.*,
    u.name as unit_name,
    p.id as property_id, p.name as property_name, p.color as property_color,
    t.first_name as tenant_first_name, t.last_name as tenant_last_name,
    t.email as tenant_email, t.phone as tenant_phone
  FROM leases l
  LEFT JOIN units u ON u.id = l.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
  LEFT JOIN tenants t ON t.id = l.primary_tenant_id
`;

export const leases = new Hono()
  .get("/", async (c) => {
    const status = c.req.query("status");
    const tenantId = intParam(c.req.query("tenant_id"));
    const unitId = intParam(c.req.query("unit_id"));
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) { where.push("l.status = ?"); params.push(status); }
    if (tenantId) { where.push("l.primary_tenant_id = ?"); params.push(tenantId); }
    if (unitId) { where.push("l.unit_id = ?"); params.push(unitId); }
    const sql = `${LEASE_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY l.start_date DESC`;
    const rows = await query<Lease>(sql, params);
    return c.json({ leases: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<Lease>(`${LEASE_SELECT} WHERE l.id = ?`, [id]);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ lease: row });
  })
  .post("/", jsonBody(LeaseInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO leases (unit_id, primary_tenant_id, start_date, end_date, monthly_rent, deposit, rent_due_day, late_fee, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.unit_id, d.primary_tenant_id ?? null, d.start_date, d.end_date, d.monthly_rent ?? 0, d.deposit ?? 0, d.rent_due_day ?? 1, d.late_fee ?? 0, d.status ?? "active", d.notes ?? null],
    );
    // Mark the unit as occupied if the new lease is active.
    if ((d.status ?? "active") === "active") {
      await run("UPDATE units SET status = 'occupied' WHERE id = ?", [d.unit_id]);
    }
    const row = await get<Lease>(`${LEASE_SELECT} WHERE l.id = ?`, [result.lastInsertRowid]);
    return c.json({ lease: row! }, 201);
  })
  .put("/:id", jsonBody(LeaseInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE leases SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Lease>(`${LEASE_SELECT} WHERE l.id = ?`, [id]);
    return c.json({ lease: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM leases WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
