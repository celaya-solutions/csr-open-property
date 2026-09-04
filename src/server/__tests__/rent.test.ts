import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";

// The rent rules only exist in terms of rows, so these tests drive the real
// routes against a throwaway SQLite file instead of mocking the database.
let app: Hono;
let db: import("better-sqlite3").Database;
let dir: string;

const json = async (res: Response) => res.json() as Promise<any>;

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "open-property-test-"));
  process.env.DB_PATH = join(dir, "test.db");
  app = (await import("../index")).default;
  db = (await import("../db")).initDB();
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec("DELETE FROM payments; DELETE FROM rent_charges; DELETE FROM leases;");
});

/**
 * A lease on the seeded unit 1. The dates sit in the future on purpose: a
 * charge whose due date has passed gets re-marked "overdue" by generate().
 */
function makeLease(fields: Partial<{
  monthly_rent: number;
  rent_due_day: number;
  start_date: string;
  end_date: string;
  status: string;
}> = {}): number {
  const l = {
    monthly_rent: 2000,
    rent_due_day: 1,
    start_date: "2027-01-01",
    end_date: "2027-12-31",
    status: "active",
    ...fields,
  };
  const res = db
    .prepare(
      `INSERT INTO leases (unit_id, start_date, end_date, monthly_rent, rent_due_day, status)
       VALUES (1, ?, ?, ?, ?, ?)`,
    )
    .run(l.start_date, l.end_date, l.monthly_rent, l.rent_due_day, l.status);
  return Number(res.lastInsertRowid);
}

const charge = (leaseId: number) =>
  db.prepare("SELECT * FROM rent_charges WHERE lease_id = ?").get(leaseId) as any;

describe("generating a period's charges", () => {
  it("creates one charge per active lease at the lease's rent and due day", async () => {
    const lease = makeLease({ monthly_rent: 1750, rent_due_day: 5 });

    const body = await json(await post("/api/rent-charges/generate", { period: "2027-04" }));

    expect(body).toEqual({ created: 1, period: "2027-04" });
    expect(charge(lease)).toMatchObject({
      period: "2027-04",
      due_date: "2027-04-05",
      amount: 1750,
      amount_paid: 0,
      status: "open",
    });
  });

  it("is idempotent — a second run creates nothing", async () => {
    makeLease();
    await post("/api/rent-charges/generate", { period: "2027-04" });

    const body = await json(await post("/api/rent-charges/generate", { period: "2027-04" }));

    expect(body.created).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM rent_charges").get()).toEqual({ n: 1 });
  });

  it("skips leases that are not active", async () => {
    makeLease({ status: "ended" });
    makeLease({ status: "upcoming" });

    expect((await json(await post("/api/rent-charges/generate", { period: "2027-04" }))).created).toBe(0);
  });

  it("skips a lease that ended before the period starts", async () => {
    makeLease({ end_date: "2027-03-31" });

    expect((await json(await post("/api/rent-charges/generate", { period: "2027-04" }))).created).toBe(0);
  });

  it("still charges a lease that ends mid-period", async () => {
    makeLease({ end_date: "2027-04-15" });

    expect((await json(await post("/api/rent-charges/generate", { period: "2027-04" }))).created).toBe(1);
  });

  it("clamps the due day to the 28th so every month has one", async () => {
    const lease = makeLease({ rent_due_day: 31 });

    await post("/api/rent-charges/generate", { period: "2027-02" });

    expect(charge(lease).due_date).toBe("2027-02-28");
  });

  it("marks unpaid past-due charges overdue", async () => {
    const lease = makeLease({ start_date: "2020-01-01", end_date: "2030-12-31" });
    await post("/api/rent-charges/generate", { period: "2020-01" });

    await post("/api/rent-charges/generate", { period: "2027-04" });

    const past = db
      .prepare("SELECT status FROM rent_charges WHERE lease_id = ? AND period = '2020-01'")
      .get(lease) as any;
    expect(past.status).toBe("overdue");
  });

  it("rejects a period that is not YYYY-MM", async () => {
    const res = await post("/api/rent-charges/generate", { period: "April" });

    expect(res.status).toBe(400);
  });
});

describe("applying payments to a charge", () => {
  async function openCharge(rent = 1000): Promise<number> {
    const lease = makeLease({ monthly_rent: rent });
    await post("/api/rent-charges/generate", { period: "2027-04" });
    return charge(lease).id as number;
  }

  it("leaves a charge partial while it is short", async () => {
    const id = await openCharge(1000);

    const body = await json(await post("/api/payments", { charge_id: id, amount: 400 }));

    expect(body.charge).toMatchObject({ amount_paid: 400, status: "partial" });
  });

  it("marks it paid once the payments cover the amount", async () => {
    const id = await openCharge(1000);
    await post("/api/payments", { charge_id: id, amount: 400 });

    const body = await json(await post("/api/payments", { charge_id: id, amount: 600 }));

    expect(body.charge).toMatchObject({ amount_paid: 1000, status: "paid" });
  });

  it("treats an overpayment as paid", async () => {
    const id = await openCharge(1000);

    const body = await json(await post("/api/payments", { charge_id: id, amount: 1200 }));

    expect(body.charge).toMatchObject({ amount_paid: 1200, status: "paid" });
  });

  it("re-settles the charge when a payment is deleted", async () => {
    const id = await openCharge(1000);
    await post("/api/payments", { charge_id: id, amount: 1000 });
    const payment = db.prepare("SELECT id FROM payments WHERE charge_id = ?").get(id) as any;

    await app.request(`/api/payments/${payment.id}`, { method: "DELETE" });

    const row = db.prepare("SELECT * FROM rent_charges WHERE id = ?").get(id) as any;
    expect(row).toMatchObject({ amount_paid: 0, status: "open" });
  });

  it("refuses a payment against a charge that does not exist", async () => {
    const res = await post("/api/payments", { charge_id: 9999, amount: 100 });

    expect(res.status).toBe(404);
  });

  it("refuses a negative payment", async () => {
    const id = await openCharge();

    expect((await post("/api/payments", { charge_id: id, amount: -50 })).status).toBe(400);
  });
});
