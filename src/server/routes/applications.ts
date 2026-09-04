import { desc, eq, getTableColumns, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { applications as applicationsTable, properties, units } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

const ApplicationInput = z.object({
  unit_id: z.number().int().nullable().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  employer: z.string().optional().nullable(),
  desired_move_in: z.string().optional().nullable(),
  status: z.enum(["new", "screening", "approved", "declined", "withdrawn"]).optional(),
  notes: z.string().optional().nullable(),
});

const selectApplications = (where?: SQL) => {
  const q = db()
    .select({
      ...getTableColumns(applicationsTable),
      unit_name: units.name,
      property_name: properties.name,
    })
    .from(applicationsTable)
    .leftJoin(units, eq(units.id, applicationsTable.unit_id))
    .leftJoin(properties, eq(properties.id, units.property_id));
  return where ? q.where(where) : q;
};

export const applications = new Hono()
  .get("/", async (c) => {
    const rows = await selectApplications().orderBy(desc(applicationsTable.created_at));
    return c.json({ applications: rows });
  })
  .post("/", jsonBody(ApplicationInput), async (c) => {
    const [{ id }] = await db().insert(applicationsTable).values(c.req.valid("json")).returning({ id: applicationsTable.id });
    const [row] = await selectApplications(eq(applicationsTable.id, id));
    return c.json({ application: row }, 201);
  })
  .put("/:id", jsonBody(ApplicationInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const changed = await db().update(applicationsTable).set(fields).where(eq(applicationsTable.id, id)).returning({ id: applicationsTable.id });
    if (!changed.length) return c.json({ error: "Not found" }, 404);
    const [row] = await selectApplications(eq(applicationsTable.id, id));
    return c.json({ application: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(applicationsTable).where(eq(applicationsTable.id, id)).returning({ id: applicationsTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
