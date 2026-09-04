import { and, asc, count, desc, eq, lt, ne, notInArray, sql, sum, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { db } from "../db";
import { leases, properties, rentCharges, tenants, units, workOrders } from "../schema";
import { byPriority } from "./work-orders";
import type { DashboardSummary, WorkOrderStatus } from "../../shared/types";

const CLOSED: WorkOrderStatus[] = ["completed", "cancelled"];

/** COUNT(*) over one table, with an optional filter. */
async function countRows(table: SQLiteTable, where?: SQL): Promise<number> {
  const q = db().select({ n: count() }).from(table);
  const [row] = await (where ? q.where(where) : q);
  return row?.n ?? 0;
}

export const dashboard = new Hono().get("/summary", async (c) => {
  const periodNow = new Date().toISOString().slice(0, 7);
  const money = (value: unknown) => Number(value ?? 0);

  const [
    propertyCount,
    unitCount,
    occupiedCount,
    vacantCount,
    activeLeases,
    upcomingMoveOuts,
    [monthTotals],
    [overdueRow],
    openWorkOrders,
    urgentWorkOrders,
    recentWorkOrders,
    upcomingExpirations,
  ] = await Promise.all([
    countRows(properties),
    countRows(units),
    countRows(units, eq(units.status, "occupied")),
    countRows(units, eq(units.status, "vacant")),
    countRows(leases, eq(leases.status, "active")),
    countRows(leases, and(eq(leases.status, "active"), sql`${leases.end_date} <= date('now', '+30 days')`)),
    db()
      .select({
        outstanding: sql<number>`COALESCE(SUM(CASE WHEN ${rentCharges.status} != 'waived'
          THEN ${rentCharges.amount} - ${rentCharges.amount_paid} ELSE 0 END), 0)`,
        collected: sum(rentCharges.amount_paid),
      })
      .from(rentCharges)
      .where(eq(rentCharges.period, periodNow)),
    db()
      .select({ total: sql<number>`COALESCE(SUM(${rentCharges.amount} - ${rentCharges.amount_paid}), 0)`, n: count() })
      .from(rentCharges)
      .where(
        and(
          sql`${rentCharges.due_date} < date('now')`,
          lt(rentCharges.amount_paid, rentCharges.amount),
          ne(rentCharges.status, "waived"),
        ),
      ),
    countRows(workOrders, notInArray(workOrders.status, CLOSED)),
    countRows(workOrders, and(eq(workOrders.priority, "urgent"), notInArray(workOrders.status, CLOSED))),
    db()
      .select({
        id: workOrders.id,
        title: workOrders.title,
        priority: workOrders.priority,
        status: workOrders.status,
        property_name: properties.name,
        unit_name: units.name,
        created_at: workOrders.created_at,
      })
      .from(workOrders)
      .leftJoin(properties, eq(properties.id, workOrders.property_id))
      .leftJoin(units, eq(units.id, workOrders.unit_id))
      .where(notInArray(workOrders.status, CLOSED))
      .orderBy(byPriority, desc(workOrders.created_at))
      .limit(6),
    db()
      .select({
        id: leases.id,
        end_date: leases.end_date,
        tenant_first_name: tenants.first_name,
        tenant_last_name: tenants.last_name,
        unit_name: units.name,
        property_name: properties.name,
      })
      .from(leases)
      .leftJoin(tenants, eq(tenants.id, leases.primary_tenant_id))
      .leftJoin(units, eq(units.id, leases.unit_id))
      .leftJoin(properties, eq(properties.id, units.property_id))
      .where(and(eq(leases.status, "active"), sql`${leases.end_date} <= date('now', '+60 days')`))
      .orderBy(asc(leases.end_date))
      .limit(6),
  ]);

  const summary: DashboardSummary = {
    period: periodNow,
    properties: propertyCount,
    units: unitCount,
    occupied: occupiedCount,
    vacant: vacantCount,
    occupancy_rate: unitCount ? Math.round((occupiedCount / unitCount) * 100) : 0,
    active_leases: activeLeases,
    upcoming_move_outs: upcomingMoveOuts,
    month_outstanding: money(monthTotals?.outstanding),
    month_collected: money(monthTotals?.collected),
    overdue_total: money(overdueRow?.total),
    overdue_count: overdueRow?.n ?? 0,
    open_work_orders: openWorkOrders,
    urgent_work_orders: urgentWorkOrders,
    recent_work_orders: recentWorkOrders,
    upcoming_expirations: upcomingExpirations,
  };
  return c.json(summary);
});
