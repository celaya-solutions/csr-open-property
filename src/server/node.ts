import { createHmac, timingSafeEqual } from "node:crypto";
import { serve } from "@hono/node-server";
import { getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import app from "./index.js";
import { get, initDB } from "./db.js";

const port = Number(process.env.PORT || 8787);
const password = process.env.APP_PASSWORD || "";
const secret = process.env.SESSION_SECRET || "";
const gateway = new Hono();

function sessionToken(): string {
  return createHmac("sha256", secret).update(password).digest("hex");
}

function matchesSession(candidate: string | undefined): boolean {
  if (!candidate || !password || !secret) return false;
  const expected = Buffer.from(sessionToken());
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

gateway.get("/api/health", async (c) => {
  const row = await get<{ ok: number }>("SELECT 1 AS ok");
  return c.json({ ok: row?.ok === 1, database: "sqlite" });
});

gateway.post("/api/session", async (c) => {
  if (!password || !secret) {
    return c.json({ error: "APP_PASSWORD and SESSION_SECRET must be set" }, 503);
  }
  const body: { password?: string } = await c.req.json<{ password?: string }>().catch(() => ({}));
  if (body.password !== password) return c.json({ error: "Wrong password" }, 401);
  setCookie(c, "course_session", sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return c.json({ ok: true });
});

gateway.use("/api/*", async (c, next) => {
  if (!matchesSession(getCookie(c, "course_session"))) {
    return c.json({ error: "Sign in with the course app password" }, 401);
  }
  await next();
});

gateway.all("*", (c) => {
  const bindings = {
    DB: {},
    UPLOADS: {},
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    CLAWNIFY_TOKEN: process.env.CLAWNIFY_TOKEN,
    SERVICES_URL: process.env.SERVICES_URL,
    LISTING_MODEL: process.env.LISTING_MODEL,
  };
  return app.fetch(c.req.raw, bindings as never);
});

initDB();
serve({ fetch: gateway.fetch, port }, ({ port: listeningPort }) => {
  console.log(`Course Edition API listening on port ${listeningPort}`);
});
