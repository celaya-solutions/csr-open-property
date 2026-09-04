import { asc, eq, getTableColumns, like, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { tenants as tenantsTable } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

const TenantInput = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  employer: z.string().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Where the tenant lives right now, read off their active lease.
// Written out in SQL: inside a subquery Drizzle drops the table prefix from an
// interpolated column, and "id" alone would bind to the wrong table.
const activeLease = <T>(column: string) => sql<T>`(
  SELECT ${sql.raw(column)} FROM leases
  LEFT JOIN units ON units.id = leases.unit_id
  LEFT JOIN properties ON properties.id = units.property_id
  WHERE leases.primary_tenant_id = tenants.id AND leases.status = 'active'
  LIMIT 1
)`;

const tenantColumns = {
  ...getTableColumns(tenantsTable),
  active_unit_id: activeLease<number | null>("units.id").as("active_unit_id"),
  active_unit_name: activeLease<string | null>("units.name").as("active_unit_name"),
  active_property_name: activeLease<string | null>("properties.name").as("active_property_name"),
};

export const tenants = new Hono()
  .get("/", async (c) => {
    const search = c.req.query("q")?.trim();
    const rows = search
      ? await db()
          .select(tenantColumns)
          .from(tenantsTable)
          .where(
            or(
              like(tenantsTable.last_name, `%${search}%`),
              like(tenantsTable.first_name, `%${search}%`),
              like(tenantsTable.email, `%${search}%`),
              like(tenantsTable.phone, `%${search}%`),
            ),
          )
          .orderBy(asc(tenantsTable.last_name), asc(tenantsTable.first_name))
          .limit(200)
      : await db()
          .select(tenantColumns)
          .from(tenantsTable)
          .orderBy(asc(tenantsTable.last_name), asc(tenantsTable.first_name))
          .limit(500);
    return c.json({ tenants: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const [row] = await db().select().from(tenantsTable).where(eq(tenantsTable.id, id));
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ tenant: row });
  })
  .post("/", jsonBody(TenantInput), async (c) => {
    const [row] = await db().insert(tenantsTable).values(c.req.valid("json")).returning();
    return c.json({ tenant: row }, 201);
  })
  .put("/:id", jsonBody(TenantInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const [row] = await db().update(tenantsTable).set(fields).where(eq(tenantsTable.id, id)).returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ tenant: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(tenantsTable).where(eq(tenantsTable.id, id)).returning({ id: tenantsTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
