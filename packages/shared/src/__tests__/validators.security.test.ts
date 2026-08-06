import { describe, it, expect } from "vitest";
import {
  registerAgentSchema,
  heartbeatSchema,
  metricsSchema,
  createProjectSchema,
  loginSchema,
  registerSchema,
  saveStatusPageSchema,
  createCloudMonitorSchema,
} from "../validators";

describe("Security Audit & Input Validation Unit Tests", () => {

  describe("Agent Registration Schema (registerAgentSchema)", () => {
    it("should accept valid agent registration input", () => {
      const validPayload = {
        projectToken: "proj_abc123xyz",
        hostname: "server-node-01",
        os: "linux",
        arch: "x86_64",
        version: "0.1.2-beta.2",
        name: "node-01-prod",
      };
      const result = registerAgentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should reject empty projectToken", () => {
      const payload = {
        projectToken: "",
        hostname: "server-01",
        os: "linux",
        arch: "amd64",
        version: "1.0.0",
        name: "agent-1",
      };
      const result = registerAgentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject agent name exceeding 100 characters to prevent DB column overflow", () => {
      const payload = {
        projectToken: "token123",
        hostname: "server-01",
        os: "linux",
        arch: "amd64",
        version: "1.0.0",
        name: "a".repeat(101),
      };
      const result = registerAgentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("Heartbeat Schema (heartbeatSchema)", () => {
    it("should accept valid ISO datetime and UUID agentId", () => {
      const payload = {
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-07T06:00:00Z",
        seq: 10,
        uptimeSec: 3600,
      };
      const result = heartbeatSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject non-UUID agentId to prevent SQL/NoSQL injection & malformed queries", () => {
      const invalidIds = ["123", "' OR 1=1 --", "not-a-uuid", "../../../etc/passwd"];
      for (const id of invalidIds) {
        const result = heartbeatSchema.safeParse({
          agentId: id,
          timestamp: "2026-08-07T06:00:00Z",
        });
        expect(result.success).toBe(false);
      }
    });

    it("should reject invalid timestamp formats", () => {
      const invalidTimestamps = ["invalid-date", "2026-99-99", "1672531199"];
      for (const ts of invalidTimestamps) {
        const result = heartbeatSchema.safeParse({
          agentId: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: ts,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Metrics Payload Schema (metricsSchema)", () => {
    it("should reject negative metric values", () => {
      const payload = {
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-07T06:00:00Z",
        cpuPct: -5, // Invalid negative CPU
        memUsedMb: 1024,
        memTotalMb: 4096,
        diskUsedMb: 5000,
        diskTotalMb: 20000,
      };
      const result = metricsSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should accept valid metrics snapshot", () => {
      const payload = {
        agentId: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-07T06:00:00Z",
        cpuPct: 15.4,
        memUsedMb: 2048,
        memTotalMb: 8192,
        diskUsedMb: 50000,
        diskTotalMb: 200000,
        netRxBps: 1024,
        netTxBps: 2048,
      };
      const result = metricsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("Authentication Schemas (loginSchema & registerSchema)", () => {
    it("should reject weak passwords (< 8 characters)", () => {
      const result = loginSchema.safeParse({
        email: "admin@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = ["admin", "admin@", "admin@.com", "javascript:alert(1)"];
      for (const email of invalidEmails) {
        const result = registerSchema.safeParse({
          email,
          password: "SecurePassword123!",
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Project & Status Page Slug Validation", () => {
    it("should enforce lowercase alphanumeric hyphens for project slug", () => {
      expect(createProjectSchema.safeParse({ name: "Test", slug: "my-project-1" }).success).toBe(true);
      expect(createProjectSchema.safeParse({ name: "Test", slug: "My Project!" }).success).toBe(false);
      expect(createProjectSchema.safeParse({ name: "Test", slug: "../path-traversal" }).success).toBe(false);
      expect(createProjectSchema.safeParse({ name: "Test", slug: "SELECT * FROM users" }).success).toBe(false);
    });

    it("should validate custom status page slugs securely", () => {
      const valid = saveStatusPageSchema.safeParse({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        title: "System Status",
        published: true,
        customSlug: "status-prod",
      });
      expect(valid.success).toBe(true);

      const invalidChar = saveStatusPageSchema.safeParse({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        title: "System Status",
        published: true,
        customSlug: "<script>alert(1)</script>",
      });
      expect(invalidChar.success).toBe(false);
    });
  });

  describe("Cloud Monitor Target URL Validation (createCloudMonitorSchema)", () => {
    it("should reject non-HTTP/HTTPS protocols to prevent SSRF against internal file/ftp resources", () => {
      const ssrfUrls = [
        "file:///etc/passwd",
        "gopher://127.0.0.1:25",
        "dict://127.0.0.1:11211",
        "ftp://example.com/file",
        "javascript:alert(1)",
      ];

      for (const url of ssrfUrls) {
        const result = createCloudMonitorSchema.safeParse({
          projectId: "550e8400-e29b-41d4-a716-446655440000",
          name: "Test Monitor",
          url,
        });
        expect(result.success).toBe(false);
      }
    });

    it("should enforce safe check intervals (min 30s, max 3600s)", () => {
      const tooFast = createCloudMonitorSchema.safeParse({
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Fast Check",
        url: "https://example.com",
        intervalSec: 5, // Under 30s minimum
      });
      expect(tooFast.success).toBe(false);
    });
  });
});
