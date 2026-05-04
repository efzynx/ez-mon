import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index";

// Serverless-safe: creates a new HTTP connection per invocation
// This is the recommended pattern for Vercel serverless functions
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
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
