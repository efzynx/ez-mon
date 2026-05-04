import { z } from "zod";

// ─── Agent Registration ──────────────────────────────────────────────────────

export const registerAgentSchema = z.object({
  projectToken: z.string().min(1, "Project token is required"),
  hostname: z.string().min(1, "Hostname is required"),
  os: z.string().min(1, "OS is required"),
  arch: z.string().min(1, "Architecture is required"),
  version: z.string().min(1, "Version is required"),
  name: z.string().min(1, "Agent name is required").max(100),
});

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export const heartbeatSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  timestamp: z.string().datetime({ offset: true }),
  seq: z.number().int().nonnegative().optional(),
  version: z.string().optional(),
  uptimeSec: z.number().nonnegative().optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const metricsSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  timestamp: z.string().datetime({ offset: true }),
  cpuPct: z.number().min(0).max(100),
  memUsedMb: z.number().int().nonnegative(),
  memTotalMb: z.number().int().positive(),
  diskUsedMb: z.number().int().nonnegative(),
  diskTotalMb: z.number().int().positive(),
  load1: z.number().nonnegative().optional(),
  netRxBps: z.number().int().nonnegative().optional(),
  netTxBps: z.number().int().nonnegative().optional(),
  containersRunning: z.number().int().nonnegative().optional(),
});

export type MetricsInput = z.infer<typeof metricsSchema>;

// ─── Project ──────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(50, "Project name too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  timezone: z.string().default("UTC"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ─── Notification Channel ─────────────────────────────────────────────────────

export const telegramConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
});

export const discordConfigSchema = z.object({
  webhookUrl: z.string().url(),
});

export const webhookConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

export const createNotificationChannelSchema = z.object({
  type: z.enum(["telegram", "discord", "webhook"]),
  name: z.string().min(1).max(100),
  config: z.union([telegramConfigSchema, discordConfigSchema, webhookConfigSchema]),
  enabled: z.boolean().default(true),
  notifyOn: z.enum(["offline", "online", "both"]).default("both"),
});

export type CreateNotificationChannelInput = z.infer<typeof createNotificationChannelSchema>;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
