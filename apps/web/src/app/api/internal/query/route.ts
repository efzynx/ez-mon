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
  // ── Auth: Validasi WORKER_SECRET ──────────────────────────────────────────
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret) {
    console.error("[internal/query] WORKER_SECRET not configured on Hub");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== workerSecret) {
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
    // Gunakan db().execute() dengan sql.raw() untuk query mentah
    // Kita perlu membangun query dengan parameter binding yang aman
    const result = await db().execute(
      sql.raw(buildParameterizedQuery(body.sql, params))
    );

    // Drizzle execute() mengembalikan array — wrap sebagai { rows }
    const rows = Array.isArray(result) ? result : [];
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[internal/query] Query execution error:", e);
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
  let result = query;
  // Ganti dari $N terbesar ke terkecil untuk menghindari $1 mengganti bagian dari $10
  for (let i = params.length; i >= 1; i--) {
    const value = params[i - 1];
    const escaped = escapeValue(value);
    result = result.replace(new RegExp(`\\$${i}`, "g"), escaped);
  }
  return result;
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
