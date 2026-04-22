#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo bash scripts/paragon-portal-ingest/setup-azure-vm-systemd.sh [run_user]
#
# Example:
#   sudo bash scripts/paragon-portal-ingest/setup-azure-vm-systemd.sh azureuser

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (use sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_USER="${1:-${SUDO_USER:-}}"

if [[ -z "${RUN_USER}" ]]; then
  echo "Could not determine run user. Pass it explicitly, e.g.:" >&2
  echo "  sudo bash scripts/paragon-portal-ingest/setup-azure-vm-systemd.sh azureuser" >&2
  exit 1
fi

if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "User does not exist: $RUN_USER" >&2
  exit 1
fi

RUN_GROUP="$(id -gn "$RUN_USER")"
RUNNER="$REPO_ROOT/scripts/paragon-portal-ingest/run-hourly.sh"
BROWSER_CACHE="$REPO_ROOT/.playwright-browsers"
SERVICE_PATH="/etc/systemd/system/fets-paragon-ingest.service"
TIMER_PATH="/etc/systemd/system/fets-paragon-ingest.timer"

if [[ ! -f "$RUNNER" ]]; then
  echo "Runner script not found: $RUNNER" >&2
  exit 1
fi

chmod +x "$RUNNER"
mkdir -p "$BROWSER_CACHE"
chown -R "$RUN_USER:$RUN_GROUP" "$BROWSER_CACHE"

echo "Installing node deps + Chromium as $RUN_USER ..."
sudo -u "$RUN_USER" env PLAYWRIGHT_BROWSERS_PATH="$BROWSER_CACHE" bash -lc "
  cd '$REPO_ROOT/scripts/paragon-portal-ingest' &&
  npm install &&
  npx playwright install chromium
"

cat >"$SERVICE_PATH" <<EOF
[Unit]
Description=FETS Paragon portal ingest
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$REPO_ROOT
Environment=PLAYWRIGHT_BROWSERS_PATH=$BROWSER_CACHE
ExecStart=/usr/bin/env bash $RUNNER
StandardOutput=journal
StandardError=journal
TimeoutStartSec=25min

[Install]
WantedBy=multi-user.target
EOF

cat >"$TIMER_PATH" <<'EOF'
[Unit]
Description=Run FETS Paragon ingest hourly

[Timer]
OnBootSec=2min
OnUnitActiveSec=1h
Persistent=true
Unit=fets-paragon-ingest.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now fets-paragon-ingest.timer
systemctl start fets-paragon-ingest.service

echo
echo "Setup complete."
echo "Check timer:"
echo "  systemctl status fets-paragon-ingest.timer --no-pager"
echo
echo "Check latest service run:"
echo "  systemctl status fets-paragon-ingest.service --no-pager"
echo
echo "Follow logs:"
echo "  journalctl -u fets-paragon-ingest.service -f"
