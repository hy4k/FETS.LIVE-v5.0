#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$REPO_ROOT/output/playwright"
LOG_FILE="$LOG_DIR/paragon-ingest-hourly.log"

mkdir -p "$LOG_DIR"

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$REPO_ROOT/.playwright-browsers}"

cd "$REPO_ROOT"
node "scripts/paragon-portal-ingest/run.mjs" >>"$LOG_FILE" 2>&1
