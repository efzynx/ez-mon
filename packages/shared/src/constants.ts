// ─── EZMON Constants ──────────────────────────────────────────────────────────

export const DEFAULTS = {
  HEARTBEAT_INTERVAL_SEC: 30,
  METRICS_INTERVAL_SEC: 60,
  GRACE_MULTIPLIER: 3,
  OFFLINE_THRESHOLD_SEC: 90, // 30 * 3
  EVALUATOR_FREQUENCY_SEC: 60,
  BUCKET_SIZE_SEC: 300, // 5 minutes
  MAX_AGENTS_PER_PROJECT: 5,
  RETENTION_DAYS: 7,
  MAX_STATUS_PAGES: 1,
} as const;

export const AGENT_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  UNKNOWN: "unknown",
} as const;

export const INCIDENT_TYPE = {
  HEARTBEAT_MISSED: "heartbeat_missed",
  RECOVERED: "recovered",
  THRESHOLD_CPU: "threshold_cpu",
  THRESHOLD_MEMORY: "threshold_memory",
  THRESHOLD_DISK: "threshold_disk",
} as const;

export const INCIDENT_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
} as const;

export const CHANNEL_TYPE = {
  TELEGRAM: "telegram",
  DISCORD: "discord",
  WEBHOOK: "webhook",
} as const;

export const ALERT_STATUS = {
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
} as const;
