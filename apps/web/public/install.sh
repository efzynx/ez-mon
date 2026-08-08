#!/bin/sh
# EZMON Agent Installer
# Usage:
#   Interactive (Recommended, prevents token in history):
#     curl -fsSL <hub>/install.sh | EZMON_SERVER_URL=<hub> sh
#   One-liner (Automation):
#     curl -fsSL <hub>/install.sh | EZMON_SERVER_URL=<hub> EZMON_TOKEN=<token> sh
# Env vars:
#   EZMON_TOKEN       — optional if running interactively, required for automation
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

# ─── Validate environment ──────────────────────────────────────────────────────
if [ -z "$EZMON_TOKEN" ]; then
  if [ -c /dev/tty ] && ( : < /dev/tty ) 2>/dev/null; then
    info "EZMON_TOKEN was not found in environment variables."
    info "Prompting interactively to prevent token leakage in bash history..."
    printf "${CYAN}[PROMPT]${RESET} Enter EZMON Project Token: "
    read -r EZMON_TOKEN < /dev/tty
    echo ""
  fi
fi

[ -z "$EZMON_TOKEN" ] && fatal "EZMON_TOKEN is required.\nUsage:\n  Interactive (Secure): curl -fsSL <url>/install.sh | sh\n  Automation          : curl -fsSL <url>/install.sh | EZMON_TOKEN=your_token sh"

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

# ─── Locate monorepo (for dev builds from source) ─────────────────────────────
MONOREPO_AGENT_DIR=""

# 1. From explicit env var
if [ -n "$EZMON_MONOREPO" ] && [ -f "$EZMON_MONOREPO/apps/agent/main.go" ]; then
  MONOREPO_AGENT_DIR="$EZMON_MONOREPO/apps/agent"
  info "Monorepo from EZMON_MONOREPO: $EZMON_MONOREPO"
fi

# 2. Working directory
if [ -z "$MONOREPO_AGENT_DIR" ] && [ -f "apps/agent/main.go" ]; then
  MONOREPO_AGENT_DIR="$(pwd)/apps/agent"
  info "Monorepo found in working directory: $(pwd)"
fi

# 3. Auto-scan common paths
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
      info "Monorepo found at: $try_path"
      break
    fi
  done
fi

# ─── Path 1: build from source (monorepo + Go available) ──────────────────────
if [ -n "$MONOREPO_AGENT_DIR" ] && command -v go > /dev/null 2>&1; then

  BUILD_VERSION="${EZMON_AGENT_VERSION:-0.1.18}"
  info "Building from source: $MONOREPO_AGENT_DIR (version $BUILD_VERSION)"
  cd "$MONOREPO_AGENT_DIR"
  info "Running go mod tidy..."
  go mod tidy 2>&1 | grep -v "^$" || true
  info "Running go build..."
  go build -ldflags="-w -s -X main.Version=${BUILD_VERSION}" -o /tmp/ezmon-agent-build . 2>&1
  cd - > /dev/null
  ok "Build complete."

  # Install binary
  if [ "$(id -u)" = "0" ]; then
    mv /tmp/ezmon-agent-build "$BINARY"
    chmod +x "$BINARY"
    ok "Binary installed to $BINARY"
  else
    warn "Not running as root — installing binary with sudo..."
    sudo mv /tmp/ezmon-agent-build "$BINARY"
    sudo chmod +x "$BINARY"
    ok "Binary installed to $BINARY (via sudo)"
  fi

# ─── Path 2: production (download pre-built binary) ───────────────────────────
elif command -v curl > /dev/null 2>&1; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  BIN_ARCH="amd64" ;;
    aarch64) BIN_ARCH="arm64" ;;
    armv7l)  BIN_ARCH="arm"   ;;
    *)       fatal "Unsupported architecture: $ARCH" ;;
  esac

  TAG_BIN_URL="https://github.com/efzynx/ez-mon/releases/download/v${AGENT_VERSION}/ezmon-agent-linux-${BIN_ARCH}-v${AGENT_VERSION}"
  LATEST_BIN_URL="https://github.com/efzynx/ez-mon/releases/download/latest/ezmon-agent-linux-$BIN_ARCH"

  if curl -fsI "$TAG_BIN_URL" >/dev/null 2>&1; then
    BIN_URL="$TAG_BIN_URL"
  else
    BIN_URL="$LATEST_BIN_URL"
  fi
  SHA_URL="${BIN_URL}.sha256"

  info "Downloading binary for linux/$BIN_ARCH from $BIN_URL..."
  curl -fsSL "$BIN_URL" -o /tmp/ezmon-agent-build || fatal "Download failed. Make sure the binary is available at $BIN_URL"

  # Verifikasi Integritas SHA-256 Checksum
  if curl -fsSL "$SHA_URL" -o /tmp/ezmon-agent-build.sha256 2>/dev/null; then
    info "Verifying SHA-256 checksum integrity..."
    EXPECTED_HASH=$(awk '{print $1}' /tmp/ezmon-agent-build.sha256)
    ACTUAL_HASH=""
    if command -v sha256sum > /dev/null 2>&1; then
      ACTUAL_HASH=$(sha256sum /tmp/ezmon-agent-build | awk '{print $1}')
    elif command -v shasum > /dev/null 2>&1; then
      ACTUAL_HASH=$(shasum -a 256 /tmp/ezmon-agent-build | awk '{print $1}')
    fi

    if [ -n "$ACTUAL_HASH" ] && [ -n "$EXPECTED_HASH" ]; then
      if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
        fatal "SHA-256 checksum verification failed! Binary download corrupted or tampered."
      fi
      ok "SHA-256 checksum verified ($ACTUAL_HASH)."
    fi
    rm -f /tmp/ezmon-agent-build.sha256
  fi

  if [ "$(id -u)" = "0" ]; then
    mv /tmp/ezmon-agent-build "$BINARY"
    chmod +x "$BINARY"
  else
    sudo mv /tmp/ezmon-agent-build "$BINARY"
    sudo chmod +x "$BINARY"
  fi
  ok "Binary installed to $BINARY"

else
  fatal "Neither Go compiler nor curl is available. Please install one and try again."
fi

# ─── Register agent with Hub ──────────────────────────────────────────────────
info "Registering agent with hub..."
OS_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH_NAME=$(uname -m)

AGENT_VERSION="${EZMON_AGENT_VERSION:-0.1.18}"
REG_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/agent/register" \
  -H "Content-Type: application/json" \
  -d "{\"projectToken\":\"$EZMON_TOKEN\",\"hostname\":\"$(hostname)\",\"os\":\"$OS_NAME\",\"arch\":\"$ARCH_NAME\",\"version\":\"$AGENT_VERSION\",\"name\":\"$AGENT_NAME\"}" 2>&1)

SUCCESS=$(echo "$REG_RESPONSE" | grep -o '"success":true' || true)
[ -z "$SUCCESS" ] && fatal "Registration failed: $REG_RESPONSE"

AGENT_ID=$(echo "$REG_RESPONSE" | sed -n 's/.*"agentId":"\([^"]*\)".*/\1/p')
AGENT_TOKEN=$(echo "$REG_RESPONSE" | sed -n 's/.*"agentToken":"\([^"]*\)".*/\1/p')

[ -z "$AGENT_ID" ]    && fatal "agentId not found in registration response"
[ -z "$AGENT_TOKEN" ] && fatal "agentToken not found in registration response"

ok "Agent registered! ID: $AGENT_ID"

# ─── Write configuration ───────────────────────────────────────────────────────
info "Saving configuration to $CONFIG_FILE..."
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
ok "Configuration saved."

# ─── Install systemd service ──────────────────────────────────────────────────
if command -v systemctl > /dev/null 2>&1; then
  info "Configuring & restarting systemd service..."
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
    systemctl stop ezmon-agent 2>/dev/null || true
    printf "%s\n" "$SERVICE_CONTENT" > "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl enable ezmon-agent
    systemctl restart ezmon-agent
  else
    sudo systemctl stop ezmon-agent 2>/dev/null || true
    echo "$SERVICE_CONTENT" | sudo tee "$SERVICE_FILE" > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable ezmon-agent
    sudo systemctl restart ezmon-agent
  fi
  ok "Service ezmon-agent is active and updated."

  echo ""
  printf "${GREEN}${BOLD}✓ Installation complete!${RESET}\n"
  echo ""
  info "Check status : sudo systemctl status ezmon-agent"
  info "View logs    : sudo journalctl -u ezmon-agent -f"
  info "Uninstall    : sudo systemctl stop ezmon-agent && sudo systemctl disable ezmon-agent"
  info "               sudo rm -f $BINARY $SERVICE_FILE $CONFIG_FILE"
  info "               sudo systemctl daemon-reload"
  echo ""

else
  # Fallback: run directly (non-systemd / container)
  warn "systemd is not available. Running agent directly (foreground)..."
  warn "To run in background: nohup $BINARY &"
  echo ""
  export EZMON_SERVER_URL="$SERVER_URL"
  export EZMON_AGENT_ID="$AGENT_ID"
  export EZMON_AGENT_TOKEN="$AGENT_TOKEN"
  exec "$BINARY"
fi
