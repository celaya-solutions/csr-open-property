import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { WorkOrder } from "../../shared/types";

const WorkOrderInput = z.object({
  property_id: z.number().int().nullable().optional(),
  unit_id: z.number().int().nullable().optional(),
  tenant_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  scheduled_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const WO_SELECT = `
  SELECT w.*,
    p.name as property_name, p.color as property_color,
    u.name as unit_name,
    t.first_name as tenant_first_name, t.last_name as tenant_last_name,
    v.name as vendor_name, v.color as vendor_color
  FROM work_orders w
  LEFT JOIN properties p ON p.id = w.property_id
  LEFT JOIN units u ON u.id = w.unit_id
  LEFT JOIN tenants t ON t.id = w.tenant_id
  LEFT JOIN vendors v ON v.id = w.vendor_id
`;

export const workOrders = new Hono()
  .get("/", async (c) => {
    const status = c.req.query("status");
    const propertyId = intParam(c.req.query("property_id"));
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) { where.push("w.status = ?"); params.push(status); }
    if (propertyId) { where.push("w.property_id = ?"); params.push(propertyId); }
    const sql = `${WO_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY
      CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      w.created_at DESC`;
    const rows = await query<WorkOrder>(sql, params).catch(() => [] as WorkOrder[]);
    return c.json({ work_orders: rows });
  })
  .post("/", jsonBody(WorkOrderInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO work_orders (property_id, unit_id, tenant_id, vendor_id, title, description, priority, status, scheduled_at, completed_at, cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.property_id ?? null, d.unit_id ?? null, d.tenant_id ?? null, d.vendor_id ?? null,
        d.title, d.description ?? null,
        d.priority ?? "normal", d.status ?? "open",
        d.scheduled_at ?? null, d.completed_at ?? null,
        d.cost ?? null, d.notes ?? null,
      ],
    );
    const row = await get<WorkOrder>(`${WO_SELECT} WHERE w.id = ?`, [result.lastInsertRowid]);
    return c.json({ work_order: row! }, 201);
  })
  .put("/:id", jsonBody(WorkOrderInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE work_orders SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<WorkOrder>(`${WO_SELECT} WHERE w.id = ?`, [id]);
    return c.json({ work_order: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM work_orders WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
