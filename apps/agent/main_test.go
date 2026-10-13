package main

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestLoadConfig(t *testing.T) {
	os.Setenv("EZMON_SERVER_URL", "https://hub.example.com")
	os.Setenv("EZMON_AGENT_ID", "test-agent-id")
	os.Setenv("EZMON_AGENT_TOKEN", "agt_test_token")
	os.Setenv("EZMON_HEARTBEAT_INTERVAL", "45")
	os.Setenv("EZMON_METRICS_INTERVAL", "90")
	defer func() {
		os.Unsetenv("EZMON_SERVER_URL")
		os.Unsetenv("EZMON_AGENT_ID")
		os.Unsetenv("EZMON_AGENT_TOKEN")
		os.Unsetenv("EZMON_HEARTBEAT_INTERVAL")
		os.Unsetenv("EZMON_METRICS_INTERVAL")
	}()

	cfg := loadConfig()

	if cfg.ServerURL != "https://hub.example.com" {
		t.Errorf("expected ServerURL https://hub.example.com, got %s", cfg.ServerURL)
	}
	if cfg.AgentID != "test-agent-id" {
		t.Errorf("expected AgentID test-agent-id, got %s", cfg.AgentID)
	}
	if cfg.HBInterval != 45*time.Second {
		t.Errorf("expected HBInterval 45s, got %v", cfg.HBInterval)
	}
	if cfg.MetInterval != 90*time.Second {
		t.Errorf("expected MetInterval 90s, got %v", cfg.MetInterval)
	}
}

func TestCollectMetrics(t *testing.T) {
	metrics, err := collectMetrics()
	if err != nil {
		t.Fatalf("collectMetrics failed: %v", err)
	}

	if metrics.MemTotalMb <= 0 {
		t.Errorf("expected MemTotalMb > 0, got %d", metrics.MemTotalMb)
	}
	if metrics.DiskTotalMb <= 0 {
		t.Errorf("expected DiskTotalMb > 0, got %d", metrics.DiskTotalMb)
	}
	if metrics.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

func TestMetricsPayloadJSON(t *testing.T) {
	payload := MetricsPayload{
		AgentID:     "550e8400-e29b-41d4-a716-446655440000",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Version:     "0.1.19",
		UptimeSec:   120,
		PublicIP:    "127.0.0.1",
		CpuPct:      12.5,
		MemUsedMb:   512,
		MemTotalMb:  2048,
		DiskUsedMb:  1024,
		DiskTotalMb: 4096,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal MetricsPayload: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if parsed["version"] != "0.1.19" {
		t.Errorf("expected version 0.1.19, got %v", parsed["version"])
	}
	if parsed["uptimeSec"] != float64(120) {
		t.Errorf("expected uptimeSec 120, got %v", parsed["uptimeSec"])
	}
	if parsed["publicIp"] != "127.0.0.1" {
		t.Errorf("expected publicIp 127.0.0.1, got %v", parsed["publicIp"])
	}
}
