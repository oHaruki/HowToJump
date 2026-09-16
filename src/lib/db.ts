import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Next reloads modules in dev, so the pool is cached on globalThis to avoid
// opening a new one on every hot reload.
const globalForDb = globalThis as unknown as { __htjSql?: ReturnType<typeof postgres> };
const sql = globalForDb.__htjSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__htjSql = sql;

export const db = drizzle(sql, { schema });
export { sql, schema };
