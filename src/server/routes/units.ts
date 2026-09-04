import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { properties, units as unitsTable } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

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

// The unit's newest active lease. Correlated subqueries rather than a join, so
// a unit with two active leases still returns one row. Written out in SQL:
// inside a subquery Drizzle drops the table prefix from an interpolated column.
const latestActiveLease = <T>(column: string) => sql<T>`(
  SELECT ${sql.raw(column)} FROM leases
  LEFT JOIN tenants ON tenants.id = leases.primary_tenant_id
  WHERE leases.unit_id = units.id AND leases.status = 'active'
  ORDER BY leases.start_date DESC LIMIT 1
)`;

const unitColumns = {
  ...getTableColumns(unitsTable),
  property_name: properties.name,
  property_color: properties.color,
  property_address: properties.address,
  property_city: properties.city,
  active_lease_id: latestActiveLease<number | null>("leases.id").as("active_lease_id"),
  active_tenant_name: latestActiveLease<string | null>(
    "tenants.first_name || ' ' || tenants.last_name",
  ).as("active_tenant_name"),
};

const selectUnits = (where?: SQL) => {
  const q = db()
    .select(unitColumns)
    .from(unitsTable)
    .leftJoin(properties, eq(properties.id, unitsTable.property_id));
  return where ? q.where(where) : q;
};

export const units = new Hono()
  .get("/", async (c) => {
    const propertyId = intParam(c.req.query("property_id"));
    const status = c.req.query("status");
    const filters = [
      propertyId ? eq(unitsTable.property_id, propertyId) : undefined,
      status ? eq(unitsTable.status, status as never) : undefined,
    ].filter(Boolean) as SQL[];
    const rows = await selectUnits(filters.length ? and(...filters) : undefined)
      .orderBy(properties.name, unitsTable.name);
    return c.json({ units: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const [row] = await selectUnits(eq(unitsTable.id, id));
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ unit: row });
  })
  .post("/", jsonBody(UnitInput), async (c) => {
    const [{ id }] = await db().insert(unitsTable).values(c.req.valid("json")).returning({ id: unitsTable.id });
    const [row] = await selectUnits(eq(unitsTable.id, id));
    return c.json({ unit: row }, 201);
  })
  .put("/:id", jsonBody(UnitInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const changed = await db().update(unitsTable).set(fields).where(eq(unitsTable.id, id)).returning({ id: unitsTable.id });
    if (!changed.length) return c.json({ error: "Not found" }, 404);
    const [row] = await selectUnits(eq(unitsTable.id, id));
    return c.json({ unit: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(unitsTable).where(eq(unitsTable.id, id)).returning({ id: unitsTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
