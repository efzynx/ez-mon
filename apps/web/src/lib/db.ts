import { getDb } from "@ezmon/db";

// Singleton per request in serverless — each invocation gets a fresh HTTP connection
// This is fine for Neon HTTP driver as it creates a new connection per query
let _db: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}
