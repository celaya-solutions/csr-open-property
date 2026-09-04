import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Tenant } from "../../shared/types";

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

const ACTIVE_LEASE_COLUMNS = `
  (SELECT u.id FROM leases l LEFT JOIN units u ON u.id = l.unit_id
     WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_id,
  (SELECT u.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id
     WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_name,
  (SELECT p.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id LEFT JOIN properties p ON p.id = u.property_id
     WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_property_name
`;

export const tenants = new Hono()
  .get("/", async (c) => {
    const search = c.req.query("q")?.trim();
    if (search) {
      const like = `%${search}%`;
      const rows = await query<Tenant>(
        `SELECT t.*, ${ACTIVE_LEASE_COLUMNS}
         FROM tenants t
         WHERE t.last_name LIKE ? OR t.first_name LIKE ? OR t.email LIKE ? OR t.phone LIKE ?
         ORDER BY t.last_name, t.first_name LIMIT 200`,
        [like, like, like, like],
      );
      return c.json({ tenants: rows });
    }
    const rows = await query<Tenant>(
      `SELECT t.*, ${ACTIVE_LEASE_COLUMNS}
       FROM tenants t ORDER BY t.last_name, t.first_name LIMIT 500`,
    );
    return c.json({ tenants: rows });
  })
  .get("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<Tenant>("SELECT * FROM tenants WHERE id = ?", [id]);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ tenant: row });
  })
  .post("/", jsonBody(TenantInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO tenants (first_name, last_name, email, phone, date_of_birth, emergency_contact, employer, monthly_income, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.first_name, d.last_name, d.email ?? null, d.phone ?? null, d.date_of_birth ?? null, d.emergency_contact ?? null, d.employer ?? null, d.monthly_income ?? null, d.notes ?? null],
    );
    const row = await get<Tenant>("SELECT * FROM tenants WHERE id = ?", [result.lastInsertRowid]);
    return c.json({ tenant: row! }, 201);
  })
  .put("/:id", jsonBody(TenantInput.partial()), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<Tenant>("SELECT * FROM tenants WHERE id = ?", [id]);
    return c.json({ tenant: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM tenants WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
