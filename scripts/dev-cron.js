/**
 * Tujuan: Script helper local cron runner untuk EZMON
 * Caller: npm run dev:cron ATAU npm run evaluate
 * Dependensi: Node.js 18+ (native fetch)
 * Deskripsi: Memicu /api/internal/evaluate secara periodik (setiap 60s) atau 1x pemicuan cepat di lokal.
 */

const HUB_URL = process.env.HUB_URL || "http://localhost:3000";
const WORKER_SECRET = process.env.WORKER_SECRET || "ezmon-internal-secret-2026";
const EVALUATE_URL = `${HUB_URL}/api/internal/evaluate`;
const isOnce = process.argv.includes("once");

console.log(`⏱️  EZMON Local Evaluator Trigger`);
console.log(`   Target  : ${EVALUATE_URL}`);
console.log(`   Mode    : ${isOnce ? "Single Trigger (Once)" : "Recurring Cron (Every 60s)"}\n`);

async function triggerEvaluate() {
  const now = new Date().toLocaleTimeString();
  try {
    const res = await fetch(EVALUATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (data.success) {
      const s = data.summary;
      console.log(
        `[${now}] ✅ Evaluated — Agents: ${s?.evaluatedAgents ?? 0}, Incidents: +${s?.newIncidents ?? 0}/-${s?.resolvedIncidents ?? 0}, Alerts: ${s?.notificationsDispatched ?? 0}, Cloud Monitors: ${s?.monitorsEvaluated ?? 0}`
      );
    } else {
      console.log(`[${now}] ⚠️  Evaluator returned error: ${data.error || "Unknown error"}`);
    }
  } catch (err) {
    console.error(`[${now}] ❌ Failed to reach web server (${err.message}). Make sure 'npm run dev' is running.`);
  }
}

triggerEvaluate();

if (!isOnce) {
  setInterval(triggerEvaluate, 60000);
}
