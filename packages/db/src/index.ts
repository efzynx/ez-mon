import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";

// Serverless-safe & pooler-safe: uses postgres-js driver
// Disables prepared statements (prepare: false) for compatibility with transaction poolers like Supabase/PgBouncer
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
    max: 10,
  });
  return drizzle(client, { schema });
}

// Convenience: create db from environment variable
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return createDb(url);
}

export type Database = ReturnType<typeof createDb>;

// Re-export schema and drizzle utilities
export * from "./schema/index";
export { eq, and, or, gt, lt, gte, lte, desc, asc, sql, count, avg, max, min, sum } from "drizzle-orm";

