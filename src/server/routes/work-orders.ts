import { and, desc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { properties, tenants, units, vendors, workOrders as workOrdersTable } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

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

// Urgent first, then high, normal, low — the order the board reads in.
export const byPriority = sql`CASE ${workOrdersTable.priority}
  WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`;

const workOrderColumns = {
  ...getTableColumns(workOrdersTable),
  property_name: properties.name,
  property_color: properties.color,
  unit_name: units.name,
  tenant_first_name: tenants.first_name,
  tenant_last_name: tenants.last_name,
  vendor_name: vendors.name,
  vendor_color: vendors.color,
};

const selectWorkOrders = (where?: SQL) => {
  const q = db()
    .select(workOrderColumns)
    .from(workOrdersTable)
    .leftJoin(properties, eq(properties.id, workOrdersTable.property_id))
    .leftJoin(units, eq(units.id, workOrdersTable.unit_id))
    .leftJoin(tenants, eq(tenants.id, workOrdersTable.tenant_id))
    .leftJoin(vendors, eq(vendors.id, workOrdersTable.vendor_id));
  return where ? q.where(where) : q;
};

export const workOrders = new Hono()
  .get("/", async (c) => {
    const status = c.req.query("status");
    const propertyId = intParam(c.req.query("property_id"));
    const filters = [
      status ? eq(workOrdersTable.status, status as never) : undefined,
      propertyId ? eq(workOrdersTable.property_id, propertyId) : undefined,
    ].filter(Boolean) as SQL[];
    const rows = await selectWorkOrders(filters.length ? and(...filters) : undefined)
      .orderBy(byPriority, desc(workOrdersTable.created_at));
    return c.json({ work_orders: rows });
  })
  .post("/", jsonBody(WorkOrderInput), async (c) => {
    const [{ id }] = await db().insert(workOrdersTable).values(c.req.valid("json")).returning({ id: workOrdersTable.id });
    const [row] = await selectWorkOrders(eq(workOrdersTable.id, id));
    return c.json({ work_order: row }, 201);
  })
  .put("/:id", jsonBody(WorkOrderInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const changed = await db().update(workOrdersTable).set(fields).where(eq(workOrdersTable.id, id)).returning({ id: workOrdersTable.id });
    if (!changed.length) return c.json({ error: "Not found" }, 404);
    const [row] = await selectWorkOrders(eq(workOrdersTable.id, id));
    return c.json({ work_order: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(workOrdersTable).where(eq(workOrdersTable.id, id)).returning({ id: workOrdersTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
