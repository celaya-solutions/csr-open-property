import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

let database: Database.Database | undefined;
let orm: BetterSQLite3Database<typeof schema> | undefined;

function schemaPath(): string {
  const local = resolve("src/server/schema.sql");
  try {
    readFileSync(local);
    return local;
  } catch {
    return resolve("schema.sql");
  }
}

export function initDB(_bindings?: unknown): Database.Database {
  if (database) return database;

  const path = resolve(process.env.DB_PATH || "data/app.db");
  mkdirSync(dirname(path), { recursive: true });
  database = new Database(path);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(readFileSync(schemaPath(), "utf8"));
  return database;
}

/**
 * The Drizzle handle every route queries through. It is created on first use
 * so that the process can set `DB_PATH` before the first request (or, in the
 * tests, before the app module is imported).
 */
export function db(): BetterSQLite3Database<typeof schema> {
  if (!orm) orm = drizzle(initDB(), { schema });
  return orm;
}
