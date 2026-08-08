/**
 * Tujuan: Shared Zod validators untuk semua boundary request/response EZMON
 * Caller: apps/web API handlers (agent, dashboard), apps/worker (indirect via types)
 * Dependensi: zod
 * Main Functions: registerAgentSchema, heartbeatSchema, metricsSchema, createProjectSchema,
 *   createNotificationChannelSchema, loginSchema, registerSchema, saveStatusPageSchema,
 *   createCloudMonitorSchema, updateCloudMonitorSchema
 * Side Effects: Tidak ada
 */

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
  publicIp: z.string().optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const metricsSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  timestamp: z.string().datetime({ offset: true }),
  cpuPct: z.number().min(0),
  cpuCores: z.array(z.number().min(0)).optional(),
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

export const updateProjectNameSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  name: z.string().min(1, "Name is required").max(50, "Project name too long"),
});

export type UpdateProjectNameInput = z.infer<typeof updateProjectNameSchema>;

// ─── Notification Channel ─────────────────────────────────────────────────────

export const telegramConfigSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
}).passthrough();

export const discordConfigSchema = z.object({
  webhookUrl: z.string().url(),
}).passthrough();

export const webhookConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
}).passthrough();

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

export const registerWithCodeSchema = registerSchema.extend({
  code: z.string().length(6, "Kode verifikasi harus 6 digit angka"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterWithCodeInput = z.infer<typeof registerWithCodeSchema>;


// ─── Status Page ──────────────────────────────────────────────────────────────

export const updateAgentStatusPageSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  showOnStatusPage: z.boolean(),
});

export type UpdateAgentStatusPageInput = z.infer<typeof updateAgentStatusPageSchema>;

export const updateAgentTagsSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  tags: z.array(z.string().max(30)).max(10, "Maximum 10 tags allowed"),
});

export type UpdateAgentTagsInput = z.infer<typeof updateAgentTagsSchema>;

export const updateAgentNameSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID"),
  name: z.string().min(1, "Name is required").max(100),
});

export type UpdateAgentNameInput = z.infer<typeof updateAgentNameSchema>;

export const saveStatusPageSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional().nullable(),
  published: z.boolean(),
  customSlug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(60, "Slug must be at most 60 characters")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .optional()
    .nullable(),
});

export type SaveStatusPageInput = z.infer<typeof saveStatusPageSchema>;

// ─── Cloud Monitor (Phase 5) ──────────────────────────────────────────────────

export const createCloudMonitorSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  name: z.string().min(1, "Name is required").max(100),
  url: z
    .string()
    .url("Must be a valid URL")
    .regex(/^https?:\/\//, "URL must start with http:// or https://"),
  // Tipe check: http (status code), tls (cert expiry), keyword (body contains)
  type: z.enum(["http", "tls", "keyword"]).default("http"),
  // Interval check minimum 30 detik, max 1 jam — free-tier friendly
  intervalSec: z
    .number()
    .int()
    .min(30, "Minimum interval is 30 seconds")
    .max(3600, "Maximum interval is 1 hour")
    .default(60),
  // Timeout max 30 detik
  timeoutSec: z
    .number()
    .int()
    .min(3, "Minimum timeout is 3 seconds")
    .max(30, "Maximum timeout is 30 seconds")
    .default(10),
  // Hanya wajib jika type=keyword
  keyword: z.string().max(200).optional(),
  // Expected HTTP status code — null berarti any 2xx
  expectedStatus: z.number().int().min(100).max(599).optional().nullable(),
  showOnStatusPage: z.boolean().default(true),
});

export type CreateCloudMonitorInput = z.infer<typeof createCloudMonitorSchema>;

export const updateCloudMonitorSchema = z.object({
  id: z.string().uuid("Invalid monitor ID"),
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  type: z.enum(["http", "tls", "keyword"]).optional(),
  intervalSec: z.number().int().min(30).max(3600).optional(),
  timeoutSec: z.number().int().min(3).max(30).optional(),
  keyword: z.string().max(200).optional().nullable(),
  expectedStatus: z.number().int().min(100).max(599).optional().nullable(),
  // active | paused
  status: z.enum(["active", "paused"]).optional(),
  showOnStatusPage: z.boolean().optional(),
});

export type UpdateCloudMonitorInput = z.infer<typeof updateCloudMonitorSchema>;
