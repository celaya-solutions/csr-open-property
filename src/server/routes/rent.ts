import { and, desc, eq, getTableColumns, lt, sql, sum, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { leases, payments as paymentsTable, properties, rentCharges as chargesTable, tenants, units } from "../schema";
import { definedFields, intParam, jsonBody } from "./shared";

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

const chargeColumns = {
  ...getTableColumns(chargesTable),
  unit_id: leases.unit_id,
  lease_rent: leases.monthly_rent,
  rent_due_day: leases.rent_due_day,
  unit_name: units.name,
  property_id: properties.id,
  property_name: properties.name,
  property_color: properties.color,
  tenant_id: tenants.id,
  tenant_first_name: tenants.first_name,
  tenant_last_name: tenants.last_name,
};

const selectCharges = (where?: SQL) => {
  const q = db()
    .select(chargeColumns)
    .from(chargesTable)
    .leftJoin(leases, eq(leases.id, chargesTable.lease_id))
    .leftJoin(units, eq(units.id, leases.unit_id))
    .leftJoin(properties, eq(properties.id, units.property_id))
    .leftJoin(tenants, eq(tenants.id, leases.primary_tenant_id));
  return where ? q.where(where) : q;
};

const oneCharge = async (id: number) => (await selectCharges(eq(chargesTable.id, id)))[0];

// Recompute a charge's amount_paid and status from its payments.
async function settleCharge(chargeId: number): Promise<void> {
  const [charge] = await db()
    .select({ amount: chargesTable.amount })
    .from(chargesTable)
    .where(eq(chargesTable.id, chargeId));
  const [totals] = await db()
    .select({ total: sum(paymentsTable.amount) })
    .from(paymentsTable)
    .where(eq(paymentsTable.charge_id, chargeId));
  const paid = Number(totals?.total ?? 0);
  const status = !charge ? "open" : paid >= charge.amount ? "paid" : paid > 0 ? "partial" : "open";
  await db().update(chargesTable).set({ amount_paid: paid, status }).where(eq(chargesTable.id, chargeId));
}

export const rentCharges = new Hono()
  .get("/", async (c) => {
    const period = c.req.query("period");
    const status = c.req.query("status");
    const filters = [
      period ? eq(chargesTable.period, period) : undefined,
      status ? eq(chargesTable.status, status as never) : undefined,
    ].filter(Boolean) as SQL[];
    const rows = await selectCharges(filters.length ? and(...filters) : undefined)
      .orderBy(chargesTable.due_date, properties.name, units.name);
    return c.json({ charges: rows });
  })
  .post("/", jsonBody(ChargeInput), async (c) => {
    const d = c.req.valid("json");
    const [created] = await db()
      .insert(chargesTable)
      .values(d)
      .onConflictDoNothing({ target: [chargesTable.lease_id, chargesTable.period] })
      .returning({ id: chargesTable.id });
    if (!created) {
      const [existing] = await selectCharges(
        and(eq(chargesTable.lease_id, d.lease_id), eq(chargesTable.period, d.period)),
      );
      if (!existing) return c.json({ error: "Not found" }, 404);
      return c.json({ charge: existing });
    }
    return c.json({ charge: await oneCharge(created.id) }, 201);
  })
  // Generate (idempotent) charges for a given period across all active leases.
  .post("/generate", jsonBody(GenerateInput), async (c) => {
    const { period } = c.req.valid("json");
    const active = await db()
      .select({
        id: leases.id,
        monthly_rent: leases.monthly_rent,
        rent_due_day: leases.rent_due_day,
        end_date: leases.end_date,
      })
      .from(leases)
      .where(eq(leases.status, "active"));
    let created = 0;
    for (const l of active) {
      // Skip if the lease doesn't cover this period at all.
      const periodStart = `${period}-01`;
      if (l.end_date < periodStart) continue;
      const day = String(Math.min(28, Math.max(1, l.rent_due_day))).padStart(2, "0");
      const inserted = await db()
        .insert(chargesTable)
        .values({ lease_id: l.id, period, due_date: `${period}-${day}`, amount: l.monthly_rent })
        .onConflictDoNothing({ target: [chargesTable.lease_id, chargesTable.period] })
        .returning({ id: chargesTable.id });
      if (inserted.length) created++;
    }
    // Re-mark anything past due as 'overdue'.
    await db()
      .update(chargesTable)
      .set({ status: "overdue" })
      .where(
        and(
          sql`${chargesTable.status} IN ('open', 'partial')`,
          lt(chargesTable.amount_paid, chargesTable.amount),
          sql`${chargesTable.due_date} < date('now')`,
        ),
      );
    return c.json({ created, period });
  })
  .get("/:id/payments", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const rows = await db()
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.charge_id, id))
      .orderBy(desc(paymentsTable.paid_at));
    return c.json({ payments: rows });
  })
  .put("/:id", jsonBody(ChargePatch), async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const fields = definedFields(c.req.valid("json"));
    if (!fields) return c.json({ error: "No fields" }, 400);
    const changed = await db().update(chargesTable).set(fields).where(eq(chargesTable.id, id)).returning({ id: chargesTable.id });
    if (!changed.length) return c.json({ error: "Not found" }, 404);
    return c.json({ charge: await oneCharge(id) });
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const gone = await db().delete(chargesTable).where(eq(chargesTable.id, id)).returning({ id: chargesTable.id });
    if (!gone.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

export const payments = new Hono()
  .post("/", jsonBody(PaymentInput), async (c) => {
    const d = c.req.valid("json");
    const [charge] = await db().select({ id: chargesTable.id }).from(chargesTable).where(eq(chargesTable.id, d.charge_id));
    if (!charge) return c.json({ error: "Charge not found" }, 404);
    await db().insert(paymentsTable).values({
      charge_id: d.charge_id,
      paid_at: d.paid_at ?? sql`(datetime('now'))`,
      amount: d.amount,
      method: d.method ?? "cash",
      reference: d.reference ?? null,
      notes: d.notes ?? null,
    });
    await settleCharge(d.charge_id);
    return c.json({ charge: await oneCharge(d.charge_id) }, 201);
  })
  .delete("/:id", async (c) => {
    const id = intParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const [gone] = await db().delete(paymentsTable).where(eq(paymentsTable.id, id)).returning({ charge_id: paymentsTable.charge_id });
    if (!gone) return c.json({ error: "Not found" }, 404);
    await settleCharge(gone.charge_id);
    return c.json({ ok: true });
  });
