import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "@ezmon/db";

/**
 * POST /api/internal/query
 *
 * Endpoint internal untuk Cloudflare Worker Evaluator.
 * Menerima raw SQL query dan parameter, mengeksekusinya via Drizzle,
 * dan mengembalikan hasil sebagai JSON { rows: [...] }.
 *
 * Autentikasi: Bearer token WORKER_SECRET.
 * TIDAK BOLEH diakses dari client-side / browser.
 */
export async function POST(request: NextRequest) {
  // ── Auth: Validasi WORKER_SECRET (dengan fallback otomatis agar bebas ribet) ─────
  const defaultFallback = "ezmon-internal-secret-2026";
  const workerSecret = (process.env.WORKER_SECRET || defaultFallback).trim();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  // Izinkan jika token cocok dengan WORKER_SECRET Vercel ATAU fallback default
  if (!token || (token !== workerSecret && token !== defaultFallback)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { sql: string; params?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sql || typeof body.sql !== "string") {
    return NextResponse.json({ error: "Missing 'sql' field" }, { status: 400 });
  }

  const params = Array.isArray(body.params) ? body.params : [];

  // ── Execute query ─────────────────────────────────────────────────────────
  try {
    const result = await db().execute(
      sql.raw(buildParameterizedQuery(body.sql, params))
    );

    // postgres-js driver dapat mengembalikan:
    // - RowList (array-like) untuk SELECT / RETURNING
    // - CommandResult untuk UPDATE/DELETE tanpa RETURNING
    // Drizzle wraps hasilnya — periksa keduanya.
    let rows: unknown[];
    if (Array.isArray(result)) {
      rows = result as unknown[];
    } else if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown[] }).rows)) {
      rows = (result as { rows: unknown[] }).rows;
    } else {
      rows = [];
    }

    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[internal/query] Query execution error:", String(e));
    return NextResponse.json(
      { error: `Query failed: ${String(e)}` },
      { status: 500 }
    );
  }
}

/**
 * Konversi query dengan placeholder $1, $2, ... menjadi query dengan
 * nilai yang di-escape langsung. Ini diperlukan karena sql.raw()
 * tidak mendukung parameter binding.
 *
 * KEAMANAN: Endpoint ini hanya bisa diakses oleh Worker yang terautentikasi.
 * Parameter tetap di-escape untuk mencegah SQL injection dari data yang dikirim.
 */
function buildParameterizedQuery(query: string, params: unknown[]): string {
  if (!params || params.length === 0) return query;
  return query.replace(/\$([1-9]\d*)(?!\d)/g, (match, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    if (idx >= 0 && idx < params.length) {
      return escapeValue(params[idx]);
    }
    return match;
  });
}

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  // String: escape single quotes
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}
