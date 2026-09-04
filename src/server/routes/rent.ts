import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "../db";
import { buildUpdate, intParam, jsonBody } from "./shared";
import type { Payment, RentCharge } from "../../shared/types";

const ChargeInput = z.object({
  lease_id: z.number().int(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  due_date: z.string(),
  amount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const PaymentInput = z.object({
  charge_id: z.number().int(),
  paid_at: z.string().optional(),
  amount: z.number().min(0),
  method: z.enum(["cash", "check", "ach", "credit", "other"]).optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ChargePatch = z.object({
  amount: z.number().min(0).optional(),
  due_date: z.string().optional(),
  status: z.enum(["open", "partial", "paid", "overdue", "waived"]).optional(),
  notes: z.string().optional().nullable(),
});

const GenerateInput = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "period (YYYY-MM) required"),
});

const CHARGE_SELECT = `
  SELECT c.*,
    l.unit_id, l.monthly_rent as lease_rent, l.rent_due_day,
    u.name as unit_name,
    p.id as property_id, p.name as property_name, p.color as property_color,
    t.id as tenant_id, t.first_name as tenant_first_name, t.last_name as tenant_last_name
  FROM rent_charges c
  LEFT JOIN leases l ON l.id = c.lease_id
  LEFT JOIN units u ON u.id = l.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
  LEFT JOIN tenants t ON t.id = l.primary_tenant_id
`;

// Recompute a charge's amount_paid and status from its payments.
async function settleCharge(chargeId: number): Promise<void> {
  const charge = await get<{ amount: number }>("SELECT amount FROM rent_charges WHERE id = ?", [chargeId]);
  const sumRow = await get<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = ?",
    [chargeId],
  );
  const paid = Number(sumRow?.total ?? 0);
  const status = !charge ? "open" : paid >= charge.amount ? "paid" : paid > 0 ? "partial" : "open";
  await run("UPDATE rent_charges SET amount_paid = ?, status = ? WHERE id = ?", [paid, status, chargeId]);
}

export const rentCharges = new Hono()
  .get("/", async (c) => {
    const period = c.req.query("period");
    const status = c.req.query("status");
    const where: string[] = [];
    const params: unknown[] = [];
    if (period) { where.push("c.period = ?"); params.push(period); }
    if (status) { where.push("c.status = ?"); params.push(status); }
    const sql = `${CHARGE_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY c.due_date, p.name, u.name`;
    const rows = await query<RentCharge>(sql, params).catch(() => [] as RentCharge[]);
    return c.json({ charges: rows });
  })
  .post("/", jsonBody(ChargeInput), async (c) => {
    const d = c.req.valid("json");
    const result = await run(
      `INSERT INTO rent_charges (lease_id, period, due_date, amount, notes) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(lease_id, period) DO NOTHING`,
      [d.lease_id, d.period, d.due_date, d.amount ?? 0, d.notes ?? null],
    );
    if (!result.changes) {
      const existing = await get<RentCharge>(`${CHARGE_SELECT} WHERE c.lease_id = ? AND c.period = ?`, [d.lease_id, d.period]);
      if (!existing) return c.json({ error: "Not found" }, 404);
      return c.json({ charge: existing });
    }
    const row = await get<RentCharge>(`${CHARGE_SELECT} WHERE c.id = ?`, [result.lastInsertRowid]);
    return c.json({ charge: row! }, 201);
  })
  // Generate (idempotent) charges for a given period across all active leases.
  .post("/generate", jsonBody(GenerateInput), async (c) => {
    const { period } = c.req.valid("json");
    const leases = await query<{ id: number; monthly_rent: number; rent_due_day: number; start_date: string; end_date: string }>(
      "SELECT id, monthly_rent, rent_due_day, start_date, end_date FROM leases WHERE status = 'active'",
    );
    let created = 0;
    for (const l of leases) {
      // Skip if the lease doesn't cover this period at all.
      const periodStart = `${period}-01`;
      if (l.end_date < periodStart) continue;
      const day = String(Math.min(28, Math.max(1, l.rent_due_day))).padStart(2, "0");
      const dueDate = `${period}-${day}`;
      const r = await run(
        `INSERT INTO rent_charges (lease_id, period, due_date, amount) VALUES (?, ?, ?, ?)
           ON CONFLICT(lease_id, period) DO NOTHING`,
        [l.id, period, dueDate, l.monthly_rent],
      );
      if (r.changes) created++;
    }
    // Re-mark anything past due as 'overdue'.
    await run(
      `UPDATE rent_charges SET status = 'overdue'
       WHERE status IN ('open', 'partial') AND amount_paid < amount AND due_date < date('now')`,
    );
    return c.json({ created, period });
  })
  .get("/:id/payments", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const rows = await query<Payment>("SELECT * FROM payments WHERE charge_id = ? ORDER BY paid_at DESC", [id]);
    return c.json({ payments: rows });
  })
  .put("/:id", jsonBody(ChargePatch), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const { sets, params } = buildUpdate(c.req.valid("json"));
    if (!sets.length) return c.json({ error: "No fields" }, 400);
    params.push(id);
    const r = await run(`UPDATE rent_charges SET ${sets.join(", ")} WHERE id = ?`, params);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    const row = await get<RentCharge>(`${CHARGE_SELECT} WHERE c.id = ?`, [id]);
    return c.json({ charge: row! });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const r = await run("DELETE FROM rent_charges WHERE id = ?", [id]);
    if (!r.changes) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

export const payments = new Hono()
  .post("/", jsonBody(PaymentInput), async (c) => {
    const d = c.req.valid("json");
    const charge = await get<{ amount: number }>("SELECT amount FROM rent_charges WHERE id = ?", [d.charge_id]);
    if (!charge) return c.json({ error: "Charge not found" }, 404);
    await run(
      `INSERT INTO payments (charge_id, paid_at, amount, method, reference, notes)
       VALUES (?, COALESCE(?, datetime('now')), ?, ?, ?, ?)`,
      [d.charge_id, d.paid_at ?? null, d.amount, d.method ?? "cash", d.reference ?? null, d.notes ?? null],
    );
    await settleCharge(d.charge_id);
    const updated = await get<RentCharge>(`${CHARGE_SELECT} WHERE c.id = ?`, [d.charge_id]);
    return c.json({ charge: updated! }, 201);
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const row = await get<{ charge_id: number }>("SELECT charge_id FROM payments WHERE id = ?", [id]);
    if (!row) return c.json({ error: "Not found" }, 404);
    await run("DELETE FROM payments WHERE id = ?", [id]);
    await settleCharge(row.charge_id);
    return c.json({ ok: true });
  });
