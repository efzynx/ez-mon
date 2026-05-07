/**
 * Tujuan: Halaman standalone Cloud Monitors di sidebar utama dashboard
 * Caller: Next.js router (/dashboard/monitors)
 * Dependensi: CloudMonitorsManagement component, /api/dashboard/projects
 * Main Functions: MonitorsPage (default export)
 * Side Effects: GET /api/dashboard/projects (ambil daftar projects untuk selector)
 */

import { Metadata } from "next";
import { MonitorsPageClient } from "./client";

export const metadata: Metadata = {
  title: "Monitors — EZMON",
  description: "Monitor URLs for HTTP status, TLS/SSL health, and keyword presence.",
};

export default function MonitorsPage() {
  return <MonitorsPageClient />;
}
