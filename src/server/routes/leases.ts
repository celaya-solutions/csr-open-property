import { and, desc, eq, getTableColumns, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { leases as leasesTable, properties, tenants, units } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

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

const leaseColumns = {
  ...getTableColumns(leasesTable),
  unit_name: units.name,
  property_id: properties.id,
  property_name: properties.name,
  property_color: properties.color,
  tenant_first_name: tenants.first_name,
  tenant_last_name: tenants.last_name,
  tenant_email: tenants.email,
  tenant_phone: tenants.phone,
};

const selectLeases = (where?: SQL) => {
  const q = db()
    .select(leaseColumns)
    .from(leasesTable)
    .leftJoin(units, eq(units.id, leasesTable.unit_id))
    .leftJoin(properties, eq(properties.id, units.property_id))
    .leftJoin(tenants, eq(tenants.id, leasesTable.primary_tenant_id));
  return where ? q.where(where) : q;
};

export const leases = new Hono()
  .get("/", async (c) => {
    const status = c.req.query("status");
    const tenantId = intParam(c.req.query("tenant_id"));
    const unitId = intParam(c.req.query("unit_id"));
    const filters = [
      status ? eq(leasesTable.status, status as never) : undefined,
      tenantId ? eq(leasesTable.primary_tenant_id, tenantId) : undefined,
      unitId ? eq(leasesTable.unit_id, unitId) : undefined,
    ].filter(Boolean) as SQL[];
    const rows = await selectLeases(filters.length ? and(...filters) : undefined)
      .orderBy(desc(leasesTable.start_date));
    return c.json({ leases: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const [row] = await selectLeases(eq(leasesTable.id, id));
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ lease: row });
  })
  .post("/", jsonBody(LeaseInput), async (c) => {
    const d = c.req.valid("json");
    const [{ id }] = await db().insert(leasesTable).values(d).returning({ id: leasesTable.id });
    // Mark the unit as occupied if the new lease is active.
    if ((d.status ?? "active") === "active") {
      await db().update(units).set({ status: "occupied" }).where(eq(units.id, d.unit_id));
    }
    const [row] = await selectLeases(eq(leasesTable.id, id));
    return c.json({ lease: row }, 201);
  })
  .put("/:id", jsonBody(LeaseInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const changed = await db().update(leasesTable).set(fields).where(eq(leasesTable.id, id)).returning({ id: leasesTable.id });
    if (!changed.length) return c.json({ error: "Not found" }, 404);
    const [row] = await selectLeases(eq(leasesTable.id, id));
    return c.json({ lease: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(leasesTable).where(eq(leasesTable.id, id)).returning({ id: leasesTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
