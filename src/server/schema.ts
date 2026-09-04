/**
 * The tables in `schema.sql`, described for Drizzle.
 *
 * `schema.sql` stays the source of truth for the database itself — it creates
 * the tables, the indexes, and the seed rows on first run. This file is the
 * typed view of those same tables, so a query that names a column that isn't
 * there is a compile error instead of a runtime one. Field names deliberately
 * match the column names, so a row spreads straight into a JSON response.
 */
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  ApplicationStatus,
  ChargeStatus,
  LeaseStatus,
  PaymentMethod,
  PropertyType,
  UnitStatus,
  VendorCategory,
  WorkOrderPriority,
  WorkOrderStatus,
} from "../shared/types";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const now = sql`(datetime('now'))`;
const createdAt = () => text("created_at").notNull().default(now);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at").notNull().default(now),
});

export const properties = sqliteTable("properties", {
  id: id(),
  name: text("name").notNull(),
  type: text("type").$type<PropertyType>().notNull().default("single_family"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  year_built: integer("year_built"),
  notes: text("notes"),
  color: text("color").notNull().default("sky"),
  created_at: createdAt(),
});

export const units = sqliteTable("units", {
  id: id(),
  property_id: integer("property_id").notNull(),
  name: text("name").notNull(),
  bedrooms: real("bedrooms").notNull().default(1),
  bathrooms: real("bathrooms").notNull().default(1),
  sqft: integer("sqft"),
  market_rent: real("market_rent").notNull().default(0),
  status: text("status").$type<UnitStatus>().notNull().default("vacant"),
  notes: text("notes"),
  created_at: createdAt(),
});

export const tenants = sqliteTable("tenants", {
  id: id(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  date_of_birth: text("date_of_birth"),
  emergency_contact: text("emergency_contact"),
  employer: text("employer"),
  monthly_income: real("monthly_income"),
  notes: text("notes"),
  created_at: createdAt(),
});

export const leases = sqliteTable("leases", {
  id: id(),
  unit_id: integer("unit_id").notNull(),
  primary_tenant_id: integer("primary_tenant_id"),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  monthly_rent: real("monthly_rent").notNull().default(0),
  deposit: real("deposit").notNull().default(0),
  rent_due_day: integer("rent_due_day").notNull().default(1),
  late_fee: real("late_fee").notNull().default(0),
  status: text("status").$type<LeaseStatus>().notNull().default("active"),
  notes: text("notes"),
  created_at: createdAt(),
});

export const rentCharges = sqliteTable("rent_charges", {
  id: id(),
  lease_id: integer("lease_id").notNull(),
  period: text("period").notNull(),
  due_date: text("due_date").notNull(),
  amount: real("amount").notNull().default(0),
  amount_paid: real("amount_paid").notNull().default(0),
  status: text("status").$type<ChargeStatus>().notNull().default("open"),
  notes: text("notes"),
  created_at: createdAt(),
});

export const payments = sqliteTable("payments", {
  id: id(),
  charge_id: integer("charge_id").notNull(),
  paid_at: text("paid_at").notNull().default(now),
  amount: real("amount").notNull().default(0),
  method: text("method").$type<PaymentMethod>().notNull().default("cash"),
  reference: text("reference"),
  notes: text("notes"),
});

export const vendors = sqliteTable("vendors", {
  id: id(),
  name: text("name").notNull(),
  category: text("category").$type<VendorCategory>().notNull().default("general"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  color: text("color").notNull().default("slate"),
  created_at: createdAt(),
});

export const workOrders = sqliteTable("work_orders", {
  id: id(),
  property_id: integer("property_id"),
  unit_id: integer("unit_id"),
  tenant_id: integer("tenant_id"),
  vendor_id: integer("vendor_id"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").$type<WorkOrderPriority>().notNull().default("normal"),
  status: text("status").$type<WorkOrderStatus>().notNull().default("open"),
  scheduled_at: text("scheduled_at"),
  completed_at: text("completed_at"),
  cost: real("cost"),
  notes: text("notes"),
  created_at: createdAt(),
});

export const applications = sqliteTable("applications", {
  id: id(),
  unit_id: integer("unit_id"),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  monthly_income: real("monthly_income"),
  employer: text("employer"),
  desired_move_in: text("desired_move_in"),
  status: text("status").$type<ApplicationStatus>().notNull().default("new"),
  notes: text("notes"),
  created_at: createdAt(),
});
