import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

let database: Database.Database | undefined;

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

function params(values: unknown[]): unknown[] {
  return values.map((value) => value === undefined ? null : value);
}

export async function query<T = any>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return initDB().prepare(sql).all(...params(values)) as T[];
}

export async function get<T = any>(
  sql: string,
  values: unknown[] = [],
): Promise<T | undefined> {
  return initDB().prepare(sql).get(...params(values)) as T | undefined;
}

export async function run(
  sql: string,
  values: unknown[] = [],
): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
  const result = initDB().prepare(sql).run(...params(values));
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}
