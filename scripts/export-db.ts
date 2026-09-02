import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const source = resolve(process.env.DB_PATH || "data/app.db");
const target = resolve(process.argv[2] || `exports/app-${new Date().toISOString().slice(0, 10)}.db`);
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(target);
