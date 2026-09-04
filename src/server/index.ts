import { Hono } from "hono";
import { initDB } from "./db";
import { applications } from "./routes/applications";
import { dashboard } from "./routes/dashboard";
import { leases } from "./routes/leases";
import { properties } from "./routes/properties";
import { payments, rentCharges } from "./routes/rent";
import { settings } from "./routes/settings";
import { tenants } from "./routes/tenants";
import { units } from "./routes/units";
import { vendors } from "./routes/vendors";
import { workOrders } from "./routes/work-orders";

const app = new Hono();

app.use("*", async (_c, next) => {
  initDB();
  await next();
});

// Mounted with a single chain so Hono can infer the client type below.
const routes = app
  .route("/api/properties", properties)
  .route("/api/units", units)
  .route("/api/tenants", tenants)
  .route("/api/leases", leases)
  .route("/api/rent-charges", rentCharges)
  .route("/api/payments", payments)
  .route("/api/vendors", vendors)
  .route("/api/work-orders", workOrders)
  .route("/api/applications", applications)
  .route("/api/dashboard", dashboard)
  .route("/api/settings", settings)
  .get("/api/health", (c) => c.json({ ok: true }));

// The client builds its typed caller from this. Changing a route's shape here
// is a compile error in the components that read it.
export type AppType = typeof routes;

export default app;
