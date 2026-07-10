import { getDb } from "@ezmon/db";

// Singleton db instance in serverless — reused across hot invocations to reuse TCP connection pool
// This pattern works for postgres-js which handles local connection pooling internally
let _db: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}
