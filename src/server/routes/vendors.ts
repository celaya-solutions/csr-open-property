import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { vendors as vendorsTable } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

const VendorInput = z.object({
  name: z.string().min(1),
  category: z.enum(["plumber", "electrician", "hvac", "handyman", "cleaning", "landscaping", "general"]).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

export const vendors = new Hono()
  .get("/", async (c) => {
    const rows = await db().select().from(vendorsTable).orderBy(vendorsTable.name);
    return c.json({ vendors: rows });
  })
  .post("/", jsonBody(VendorInput), async (c) => {
    const [row] = await db().insert(vendorsTable).values(c.req.valid("json")).returning();
    return c.json({ vendor: row }, 201);
  })
  .put("/:id", jsonBody(VendorInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const [row] = await db().update(vendorsTable).set(fields).where(eq(vendorsTable.id, id)).returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ vendor: row });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(vendorsTable).where(eq(vendorsTable.id, id)).returning({ id: vendorsTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
