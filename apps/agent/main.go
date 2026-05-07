// Tujuan: Agent EZMON — push heartbeat dan real metrics ke Hub (Next.js API)
// Caller: Dijalankan sebagai proses daemon di server user (via systemd / manual)
// Dependensi: gopsutil/v4 (CPU, mem, disk, net, load), stdlib net/http
// Main Functions: main(), loadConfig(), register(), sendHeartbeat(), sendMetrics(), collectMetrics()
// Side Effects: HTTP POST ke /api/agent/heartbeat dan /api/agent/metrics di Hub

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

// ─── Public IP Helper ─────────────────────────────────────────────────────────

var cachedPublicIP string

func getPublicIP() string {
	if cachedPublicIP != "" {
		return cachedPublicIP
	}
	services := []string{
		"https://api.ipify.org",
		"https://icanhazip.com",
		"https://api4.my-ip.io/ip",
	}
	for _, svc := range services {
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(svc)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}
		ip := string(bytes.TrimSpace(body))
		if ip != "" {
			cachedPublicIP = ip
			log.Printf("[agent] Public IP detected: %s", ip)
			return ip
		}
	}
	log.Printf("[agent] Could not detect public IP")
	return ""
}

// ─── Config ───────────────────────────────────────────────────────────────────

type Config struct {
	ServerURL    string
	AgentID      string
	AgentToken   string
	AgentName    string
	ProjectToken string
	HBInterval   time.Duration
	MetInterval  time.Duration
}

// ─── Payload Types ────────────────────────────────────────────────────────────

type HeartbeatPayload struct {
	AgentID   string `json:"agentId"`
	Timestamp string `json:"timestamp"`
	Seq       int64  `json:"seq"`
	Version   string `json:"version"`
	UptimeSec int64  `json:"uptimeSec"`
	PublicIP  string `json:"publicIp,omitempty"`
}

type MetricsPayload struct {
	AgentID           string    `json:"agentId"`
	Timestamp         string    `json:"timestamp"`
	CpuPct            float64   `json:"cpuPct"`
	CpuCores          []float64 `json:"cpuCores,omitempty"`
	MemUsedMb         int64     `json:"memUsedMb"`
	MemTotalMb        int64     `json:"memTotalMb"`
	DiskUsedMb        int64     `json:"diskUsedMb"`
	DiskTotalMb       int64     `json:"diskTotalMb"`
	Load1             float64   `json:"load1,omitempty"`
	NetRxBps          int64     `json:"netRxBps,omitempty"`
	NetTxBps          int64     `json:"netTxBps,omitempty"`
	ContainersRunning *int      `json:"containersRunning,omitempty"`
}

type RegisterRequest struct {
	ProjectToken string `json:"projectToken"`
	Hostname     string `json:"hostname"`
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	Version      string `json:"version"`
	Name         string `json:"name"`
}

type RegisterResponse struct {
	Success bool `json:"success"`
	Data    struct {
		AgentID           string `json:"agentId"`
		AgentToken        string `json:"agentToken"`
		HeartbeatInterval int    `json:"heartbeatIntervalSec"`
		MetricsInterval   int    `json:"metricsIntervalSec"`
	} `json:"data"`
}

// Version is set at build time via: go build -ldflags="-X main.Version=x.y.z"
// Defaults to "dev" for local builds without ldflags.
var Version = "dev"

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	cfg := loadConfig()

	log.Printf("[ezmon-agent] Starting v%s", Version)
	log.Printf("[ezmon-agent] Server: %s", cfg.ServerURL)

	// Register jika belum punya Agent ID
	if cfg.AgentID == "" {
		log.Println("[ezmon-agent] No agent ID, registering...")
		if err := register(&cfg); err != nil {
			log.Fatalf("[ezmon-agent] Registration failed: %v", err)
		}
		log.Printf("[ezmon-agent] Registered as %s", cfg.AgentID)
	}

	startTime := time.Now()
	var seq int64

	// Signal handling untuk graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	hbTicker := time.NewTicker(cfg.HBInterval)
	metTicker := time.NewTicker(cfg.MetInterval)
	defer hbTicker.Stop()
	defer metTicker.Stop()

	// Initial heartbeat + metrics saat startup
	sendHeartbeat(cfg, seq, startTime)
	seq++
	sendMetrics(cfg)

	log.Printf("[ezmon-agent] Running (heartbeat=%s, metrics=%s)", cfg.HBInterval, cfg.MetInterval)

	for {
		select {
		case <-hbTicker.C:
			sendHeartbeat(cfg, seq, startTime)
			seq++
		case <-metTicker.C:
			sendMetrics(cfg)
		case sig := <-sigCh:
			log.Printf("[ezmon-agent] Received %s, shutting down", sig)
			return
		}
	}
}

// ─── Config Loader ────────────────────────────────────────────────────────────

func loadConfig() Config {
	serverURL := os.Getenv("EZMON_SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:3000"
	}

	// Default intervals — akan di-override dari respons register atau env
	hbSec := 30
	metSec := 60

	// Baca dari env (di-set oleh install.sh di /etc/ezmon/agent.env)
	if v := os.Getenv("EZMON_HEARTBEAT_INTERVAL"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			hbSec = n
		}
	}
	if v := os.Getenv("EZMON_METRICS_INTERVAL"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			metSec = n
		}
	}

	return Config{
		ServerURL:    serverURL,
		AgentID:      os.Getenv("EZMON_AGENT_ID"),
		AgentToken:   os.Getenv("EZMON_AGENT_TOKEN"),
		AgentName:    os.Getenv("EZMON_AGENT_NAME"), // opsional, fallback ke hostname
		ProjectToken: os.Getenv("EZMON_PROJECT_TOKEN"),
		HBInterval:   time.Duration(hbSec) * time.Second,
		MetInterval:  time.Duration(metSec) * time.Second,
	}
}

// ─── Register ─────────────────────────────────────────────────────────────────

func register(cfg *Config) error {
	// Ambil hostname aktual dari OS Linux
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "unknown-host"
		log.Printf("[register] Warning: could not get hostname: %v", err)
	}

	// Nama agent: prioritas env var, fallback ke hostname Linux
	name := cfg.AgentName
	if name == "" {
		name = hostname
		log.Printf("[register] Using hostname as agent name: %s", name)
	}

	payload := RegisterRequest{
		ProjectToken: cfg.ProjectToken,
		Hostname:     hostname,
		OS:           runtime.GOOS,
		Arch:         runtime.GOARCH,
		Version:      Version,
		Name:         name,
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(cfg.ServerURL+"/api/agent/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return fmt.Errorf("server returned HTTP %d", resp.StatusCode)
	}

	var result RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode failed: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("server rejected registration")
	}

	cfg.AgentID = result.Data.AgentID
	cfg.AgentToken = result.Data.AgentToken
	cfg.HBInterval = time.Duration(result.Data.HeartbeatInterval) * time.Second
	cfg.MetInterval = time.Duration(result.Data.MetricsInterval) * time.Second

	return nil
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

func sendHeartbeat(cfg Config, seq int64, startTime time.Time) {
	payload := HeartbeatPayload{
		AgentID:   cfg.AgentID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Seq:       seq,
		Version:   Version,
		UptimeSec: int64(time.Since(startTime).Seconds()),
		PublicIP:  getPublicIP(),
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", cfg.ServerURL+"/api/agent/heartbeat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[heartbeat] Error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("[heartbeat] Failed: HTTP %d", resp.StatusCode)
	}
}

// ─── Metrics Collection ───────────────────────────────────────────────────────

// collectMetrics mengambil data CPU, Mem, Disk, Load, Net dari OS via gopsutil
func collectMetrics() (MetricsPayload, error) {
	p := MetricsPayload{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		// Default safe fallback agar payload tetap valid bila sebagian gagal
		MemTotalMb:  1,
		DiskTotalMb: 1,
	}

	// CPU — single blocking 1-second call with perCPU=true for accurate per-core values
	cpuCores, err := cpu.Percent(1*time.Second, true)
	if err == nil && len(cpuCores) > 0 {
		// Overall average = mean of all cores
		total := 0.0
		for _, v := range cpuCores {
			total += v
		}
		p.CpuPct = total / float64(len(cpuCores))
		p.CpuCores = cpuCores
	} else {
		log.Printf("[metrics] CPU read error: %v", err)
	}

	// Memory
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		p.MemUsedMb = int64(vmStat.Used / 1024 / 1024)
		p.MemTotalMb = int64(vmStat.Total / 1024 / 1024)
		if p.MemTotalMb == 0 {
			p.MemTotalMb = 1 // guard div/zero di Hub
		}
	} else {
		log.Printf("[metrics] Memory read error: %v", err)
	}

	// Disk — root partition "/"
	diskStat, err := disk.Usage("/")
	if err == nil {
		p.DiskUsedMb = int64(diskStat.Used / 1024 / 1024)
		p.DiskTotalMb = int64(diskStat.Total / 1024 / 1024)
		if p.DiskTotalMb == 0 {
			p.DiskTotalMb = 1
		}
	} else {
		log.Printf("[metrics] Disk read error: %v", err)
	}

	// Load Average (Linux/macOS only — graceful skip di platform lain)
	loadStat, err := load.Avg()
	if err == nil {
		p.Load1 = loadStat.Load1
	}

	// Network — total delta Rx/Tx sejak boot (semua interface)
	netStats, err := net.IOCounters(false) // false = aggregate semua interface
	if err == nil && len(netStats) > 0 {
		p.NetRxBps = int64(netStats[0].BytesRecv)
		p.NetTxBps = int64(netStats[0].BytesSent)
	} else if err != nil {
		log.Printf("[metrics] Network read error: %v", err)
	}

	// Docker containers running
	out, err := exec.Command("docker", "ps", "-q").Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		count := 0
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				count++
			}
		}
		p.ContainersRunning = &count
	}

	return p, nil
}

// ─── Send Metrics ─────────────────────────────────────────────────────────────

func sendMetrics(cfg Config) {
	payload, err := collectMetrics()
	if err != nil {
		log.Printf("[metrics] Collection error: %v", err)
		return
	}
	payload.AgentID = cfg.AgentID

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", cfg.ServerURL+"/api/agent/metrics", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[metrics] Error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("[metrics] Failed: HTTP %d", resp.StatusCode)
	}
}
