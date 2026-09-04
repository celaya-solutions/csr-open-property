import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Application } from "../../shared/types";

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

const APPLICATION_SELECT = `
  SELECT a.*, u.name as unit_name, p.name as property_name
  FROM applications a
  LEFT JOIN units u ON u.id = a.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
`;

export const applications = new Hono()
  .get("/", async (c) => {
    const rows = await query<Application>(`${APPLICATION_SELECT} ORDER BY a.created_at DESC`)
      .catch(() => [] as Application[]);
    return c.json({ applications: rows });
  })
  .post("/", jsonBody(ApplicationInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO applications (unit_id, first_name, last_name, email, phone, monthly_income, employer, desired_move_in, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.unit_id ?? null, d.first_name, d.last_name,
        d.email ?? null, d.phone ?? null, d.monthly_income ?? null, d.employer ?? null,
        d.desired_move_in ?? null, d.status ?? "new", d.notes ?? null,
      ],
    );
    const row = await get<Application>(`${APPLICATION_SELECT} WHERE a.id = ?`, [result.lastInsertRowid]);
    return c.json({ application: row! }, 201);
  })
  .put("/:id", jsonBody(ApplicationInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Application>(`${APPLICATION_SELECT} WHERE a.id = ?`, [id]);
    return c.json({ application: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM applications WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
