import { eq, getTableColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { properties as propertiesTable } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

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

// Written out in SQL: inside a subquery Drizzle drops the table prefix from an
// interpolated column, and "id" alone would bind to units, not properties.
const countUnits = (status?: "occupied") => sql<number>`(
  SELECT COUNT(*) FROM units
  WHERE units.property_id = properties.id
  ${status ? sql`AND units.status = ${status}` : sql``}
)`;

export const properties = new Hono()
  .get("/", async (c) => {
    const rows = await db()
      .select({
        ...getTableColumns(propertiesTable),
        unit_count: countUnits(),
        occupied_count: countUnits("occupied"),
      })
      .from(propertiesTable)
      .orderBy(propertiesTable.name);
    return c.json({ properties: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const [row] = await db().select().from(propertiesTable).where(eq(propertiesTable.id, id));
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ property: row });
  })
  .post("/", jsonBody(PropertyInput), async (c) => {
    const d = c.req.valid("json");
    const [row] = await db().insert(propertiesTable).values(d).returning();
    return c.json({ property: row }, 201);
  })
  .put("/:id", jsonBody(PropertyInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const [row] = await db().update(propertiesTable).set(fields).where(eq(propertiesTable.id, id)).returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ property: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(propertiesTable).where(eq(propertiesTable.id, id)).returning({ id: propertiesTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
