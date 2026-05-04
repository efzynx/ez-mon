// ─── Derived Status Types ─────────────────────────────────────────────────────

export type AgentStatus = "online" | "offline" | "unknown";

export type IncidentType = "heartbeat_missed" | "recovered" | "threshold_cpu" | "threshold_memory" | "threshold_disk";

export type IncidentStatus = "open" | "resolved";

export type ChannelType = "telegram" | "discord" | "webhook";

export type AlertStatus = "queued" | "sent" | "failed";

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AgentRegistrationResponse {
  agentId: string;
  agentToken: string;
  heartbeatIntervalSec: number;
  metricsIntervalSec: number;
  uploadUrl: string;
}

export interface DashboardAgent {
  id: string;
  name: string;
  hostname: string | null;
  os: string | null;
  arch: string | null;
  version: string | null;
  status: AgentStatus;
  derivedStatus: AgentStatus;
  lastSeenAt: string | null;
  offlineDeadlineAt: string | null;
  heartbeatIntervalSec: number;
  graceMultiplier: number;
  createdAt: string;
  state?: AgentStateSnapshot | null;
}

export interface AgentStateSnapshot {
  cpuPct: number | null;
  memUsedMb: number | null;
  memTotalMb: number | null;
  diskUsedMb: number | null;
  diskTotalMb: number | null;
  load1: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  containersRunning: number | null;
  collectedAt: string;
}

export interface DashboardOverview {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  unknownAgents: number;
  openIncidents: number;
  recentIncidents: DashboardIncident[];
  agents: DashboardAgent[];
}

export interface DashboardIncident {
  id: string;
  agentId: string;
  agentName: string;
  type: IncidentType;
  status: IncidentStatus;
  message: string | null;
  startedAt: string;
  resolvedAt: string | null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Compute derived status from offline_deadline_at.
 * This ensures UI is always accurate even if evaluator is delayed.
 */
export function computeDerivedStatus(
  offlineDeadlineAt: Date | string | null,
  lastSeenAt: Date | string | null
): AgentStatus {
  if (!lastSeenAt) return "unknown";
  if (!offlineDeadlineAt) return "unknown";

  const deadline =
    typeof offlineDeadlineAt === "string"
      ? new Date(offlineDeadlineAt)
      : offlineDeadlineAt;

  const now = new Date();
  return now > deadline ? "offline" : "online";
}

/**
 * Compute offline_deadline_at from last_seen_at + interval * multiplier.
 */
export function computeOfflineDeadline(
  lastSeenAt: Date,
  heartbeatIntervalSec: number,
  graceMultiplier: number
): Date {
  return new Date(
    lastSeenAt.getTime() + heartbeatIntervalSec * graceMultiplier * 1000
  );
}
