import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  boolean,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  json,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_projects_user_id").on(table.userId),
    uniqueIndex("idx_projects_user_slug").on(table.userId, table.slug),
  ]
);

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    hostname: text("hostname"),
    os: text("os"),
    arch: text("arch"),
    version: text("version"),
    status: text("status").notNull().default("unknown"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    offlineDeadlineAt: timestamp("offline_deadline_at", {
      withTimezone: true,
    }),
    heartbeatIntervalSec: integer("heartbeat_interval_sec")
      .notNull()
      .default(30),
    graceMultiplier: integer("grace_multiplier").notNull().default(3),
    metricsIntervalSec: integer("metrics_interval_sec").notNull().default(60),
    lastIp: text("last_ip"),
    country: text("country"),
    city: text("city"),
    lat: real("lat"),
    lon: real("lon"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_agents_project_id").on(table.projectId),
    index("idx_agents_status").on(table.status),
    index("idx_agents_offline_deadline").on(table.offlineDeadlineAt),
  ]
);

// ─── Agent State (Latest Snapshot) ────────────────────────────────────────────

export const agentState = pgTable("agent_state", {
  agentId: uuid("agent_id")
    .primaryKey()
    .references(() => agents.id, { onDelete: "cascade" }),
  cpuPct: real("cpu_pct"),
  cpuCores: json("cpu_cores").$type<number[]>(),
  memUsedMb: integer("mem_used_mb"),
  memTotalMb: integer("mem_total_mb"),
  diskUsedMb: integer("disk_used_mb"),
  diskTotalMb: integer("disk_total_mb"),
  load1: real("load_1"),
  netRxBps: bigint("net_rx_bps", { mode: "number" }),
  netTxBps: bigint("net_tx_bps", { mode: "number" }),
  containersRunning: integer("containers_running"),
  collectedAt: timestamp("collected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Metric Buckets (1-min Aggregation) ───────────────────────────────────────

export const metricBuckets = pgTable(
  "metric_buckets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    bucketSizeSec: integer("bucket_size_sec").notNull().default(60),
    cpuAvg: real("cpu_avg"),
    cpuMax: real("cpu_max"),
    cpuCoresAvg: json("cpu_cores_avg").$type<number[]>(),
    memAvg: real("mem_avg"),
    diskAvg: real("disk_avg"),
    loadAvg: real("load_avg"),
    rxSum: bigint("rx_sum", { mode: "number" }),
    txSum: bigint("tx_sum", { mode: "number" }),
    sampleCount: integer("sample_count").notNull().default(0),
  },
  (table) => [
    index("idx_metric_buckets_agent_time").on(
      table.agentId,
      table.bucketStart
    ),
    uniqueIndex("idx_metric_buckets_unique").on(
      table.agentId,
      table.bucketStart,
      table.bucketSizeSec
    ),
  ]
);

// ─── Incidents ────────────────────────────────────────────────────────────────

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // heartbeat_missed, recovered, threshold_cpu
    status: text("status").notNull().default("open"),
    message: text("message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_incidents_project_id").on(table.projectId),
    index("idx_incidents_agent_id").on(table.agentId),
    index("idx_incidents_status").on(table.status),
    index("idx_incidents_started_at").on(table.startedAt),
  ]
);

// ─── Notification Channels ────────────────────────────────────────────────────

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // telegram, discord, webhook
    name: text("name").notNull(),
    configJson: jsonb("config_json").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    notifyOn: text("notify_on").notNull().default("both"), // offline | online | both
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_notification_channels_project").on(table.projectId),
  ]
);

// ─── Alert Events ─────────────────────────────────────────────────────────────

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"), // queued, sent, failed
    sentAt: timestamp("sent_at", { withTimezone: true }),
    responseCode: integer("response_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_alert_events_incident").on(table.incidentId),
  ]
);
