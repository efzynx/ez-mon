#!/bin/sh
# EZMON Agent Installer
# Usage: curl -fsSL <hub>/install.sh | EZMON_TOKEN=<token> sh
# Env vars:
#   EZMON_TOKEN       — required, project token
#   EZMON_SERVER_URL  — optional, default https://your-hub.vercel.app
#   EZMON_AGENT_NAME  — optional, override agent name (default: hostname)
set -e

BOLD="\033[1m"; RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"; RESET="\033[0m"
info()  { printf "${CYAN}[INFO]${RESET}  %s\n" "$1"; }
ok()    { printf "${GREEN}[OK]${RESET}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${RESET}  %s\n" "$1"; }
fatal() { printf "${RED}[ERROR]${RESET} %s\n" "$1"; exit 1; }

echo ""
printf "${BOLD}==========================================${RESET}\n"
printf "${BOLD}    EZMON Agent Installer                 ${RESET}\n"
printf "${BOLD}==========================================${RESET}\n"
echo ""

# ─── Validasi environment ──────────────────────────────────────────────────────
[ -z "$EZMON_TOKEN" ] && fatal "EZMON_TOKEN is required.\nUsage: curl -fsSL <url>/install.sh | EZMON_TOKEN=your_token sh"

SERVER_URL="${EZMON_SERVER_URL:-http://localhost:3000}"
AGENT_NAME="${EZMON_AGENT_NAME:-$(hostname)}"
INSTALL_DIR="/usr/local/bin"
BINARY="$INSTALL_DIR/ezmon-agent"
CONFIG_DIR="/etc/ezmon"
CONFIG_FILE="$CONFIG_DIR/agent.env"
SERVICE_FILE="/etc/systemd/system/ezmon-agent.service"

info "Hub URL   : $SERVER_URL"
info "Agent name: $AGENT_NAME"
echo ""

# ─── Cari monorepo (untuk dev build dari source) ──────────────────────────────
MONOREPO_AGENT_DIR=""

# 1. Dari env var eksplisit
if [ -n "$EZMON_MONOREPO" ] && [ -f "$EZMON_MONOREPO/apps/agent/main.go" ]; then
  MONOREPO_AGENT_DIR="$EZMON_MONOREPO/apps/agent"
  info "Monorepo dari EZMON_MONOREPO: $EZMON_MONOREPO"
fi

# 2. Working directory
if [ -z "$MONOREPO_AGENT_DIR" ] && [ -f "apps/agent/main.go" ]; then
  MONOREPO_AGENT_DIR="$(pwd)/apps/agent"
  info "Monorepo ditemukan di working dir: $(pwd)"
fi

# 3. Auto-scan path umum
if [ -z "$MONOREPO_AGENT_DIR" ]; then
  for try_path in \
    "$HOME/Project/EZMON" \
    "$HOME/project/EZMON" \
    "$HOME/projects/EZMON" \
    "$HOME/dev/EZMON" \
    "$HOME/code/EZMON" \
    "$HOME/EZMON" \
    "/opt/ezmon"; do
    if [ -f "$try_path/apps/agent/main.go" ]; then
      MONOREPO_AGENT_DIR="$try_path/apps/agent"
      info "Monorepo ditemukan di: $try_path"
      break
    fi
  done
fi

# ─── Path 1: build dari source (monorepo + Go tersedia) ───────────────────────
if [ -n "$MONOREPO_AGENT_DIR" ] && command -v go > /dev/null 2>&1; then

  info "Build dari source: $MONOREPO_AGENT_DIR"
  cd "$MONOREPO_AGENT_DIR"
  info "go mod tidy..."
  go mod tidy 2>&1 | grep -v "^$" || true
  info "go build..."
  go build -o /tmp/ezmon-agent-build . 2>&1
  cd - > /dev/null
  ok "Build selesai."

  # Install binary
  if [ "$(id -u)" = "0" ]; then
    mv /tmp/ezmon-agent-build "$BINARY"
    chmod +x "$BINARY"
    ok "Binary diinstall ke $BINARY"
  else
    warn "Bukan root — install binary dengan sudo..."
    sudo mv /tmp/ezmon-agent-build "$BINARY"
    sudo chmod +x "$BINARY"
    ok "Binary diinstall ke $BINARY (via sudo)"
  fi

# ─── Path 2: production (download pre-built binary) ───────────────────────────
elif command -v curl > /dev/null 2>&1; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  BIN_ARCH="amd64" ;;
    aarch64) BIN_ARCH="arm64" ;;
    armv7l)  BIN_ARCH="arm"   ;;
    *)       fatal "Arsitektur tidak didukung: $ARCH" ;;
  esac

  BIN_URL="https://github.com/efzynx/ez-mon/releases/download/latest/ezmon-agent-linux-$BIN_ARCH"
  info "Download binary untuk linux/$BIN_ARCH dari $BIN_URL..."
  curl -fsSL "$BIN_URL" -o /tmp/ezmon-agent-build || fatal "Download gagal. Pastikan binary sudah di-host di $BIN_URL"

  if [ "$(id -u)" = "0" ]; then
    mv /tmp/ezmon-agent-build "$BINARY"
    chmod +x "$BINARY"
  else
    sudo mv /tmp/ezmon-agent-build "$BINARY"
    sudo chmod +x "$BINARY"
  fi
  ok "Binary diinstall ke $BINARY"

else
  fatal "Tidak ada Go compiler maupun curl. Install salah satu dan coba lagi."
fi

# ─── Register agent ke Hub ────────────────────────────────────────────────────
info "Mendaftarkan agent ke hub..."
OS_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH_NAME=$(uname -m)

AGENT_VERSION="${EZMON_AGENT_VERSION:-0.1.1}"
REG_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/agent/register" \
  -H "Content-Type: application/json" \
  -d "{\"projectToken\":\"$EZMON_TOKEN\",\"hostname\":\"$(hostname)\",\"os\":\"$OS_NAME\",\"arch\":\"$ARCH_NAME\",\"version\":\"$AGENT_VERSION\",\"name\":\"$AGENT_NAME\"}" 2>&1)

SUCCESS=$(echo "$REG_RESPONSE" | grep -o '"success":true' || true)
[ -z "$SUCCESS" ] && fatal "Registrasi gagal: $REG_RESPONSE"

AGENT_ID=$(echo "$REG_RESPONSE" | sed -n 's/.*"agentId":"\([^"]*\)".*/\1/p')
AGENT_TOKEN=$(echo "$REG_RESPONSE" | sed -n 's/.*"agentToken":"\([^"]*\)".*/\1/p')

[ -z "$AGENT_ID" ]    && fatal "agentId tidak ditemukan di response registrasi"
[ -z "$AGENT_TOKEN" ] && fatal "agentToken tidak ditemukan di response registrasi"

ok "Agent terdaftar! ID: $AGENT_ID"

# ─── Buat konfigurasi ─────────────────────────────────────────────────────────
info "Menyimpan konfigurasi ke $CONFIG_FILE..."
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" <<EOF
EZMON_SERVER_URL=$SERVER_URL
EZMON_AGENT_ID=$AGENT_ID
EZMON_AGENT_TOKEN=$AGENT_TOKEN
EZMON_HEARTBEAT_INTERVAL=30
EOF
  chmod 600 "$CONFIG_FILE"
else
  sudo mkdir -p "$CONFIG_DIR"
  sudo tee "$CONFIG_FILE" > /dev/null <<EOF
EZMON_SERVER_URL=$SERVER_URL
EZMON_AGENT_ID=$AGENT_ID
EZMON_AGENT_TOKEN=$AGENT_TOKEN
EZMON_HEARTBEAT_INTERVAL=30
EOF
  sudo chmod 600 "$CONFIG_FILE"
fi
ok "Konfigurasi disimpan."

# ─── Install systemd service ─────────────────────────────────────────────────
if command -v systemctl > /dev/null 2>&1; then
  info "Menginstall systemd service..."
  SERVICE_CONTENT="[Unit]
Description=EZMON Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$CONFIG_FILE
ExecStart=$BINARY
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"

  if [ "$(id -u)" = "0" ]; then
    printf "%s\n" "$SERVICE_CONTENT" > "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl enable --now ezmon-agent
  else
    echo "$SERVICE_CONTENT" | sudo tee "$SERVICE_FILE" > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable --now ezmon-agent
  fi
  ok "Service ezmon-agent aktif dan enabled."

  echo ""
  printf "${GREEN}${BOLD}✓ Instalasi selesai!${RESET}\n"
  echo ""
  info "Cek status  : sudo systemctl status ezmon-agent"
  info "Lihat log   : sudo journalctl -u ezmon-agent -f"
  info "Uninstall   : sudo systemctl stop ezmon-agent && sudo systemctl disable ezmon-agent"
  info "              sudo rm -f $BINARY $SERVICE_FILE $CONFIG_FILE"
  info "              sudo systemctl daemon-reload"
  echo ""

else
  # Fallback: jalankan langsung (non-systemd / container)
  warn "systemd tidak tersedia. Menjalankan agent secara langsung (foreground)..."
  warn "Untuk background: nohup $BINARY &"
  echo ""
  export EZMON_SERVER_URL="$SERVER_URL"
  export EZMON_AGENT_ID="$AGENT_ID"
  export EZMON_AGENT_TOKEN="$AGENT_TOKEN"
  exec "$BINARY"
fi
