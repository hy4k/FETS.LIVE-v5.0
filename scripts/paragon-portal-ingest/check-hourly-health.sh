#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-fets-paragon-ingest.service}"
TIMER_NAME="${2:-fets-paragon-ingest.timer}"
MAX_AGE_MINUTES="${MAX_AGE_MINUTES:-125}"

if ! systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | rg -q "^${SERVICE_NAME}$"; then
  echo "ERROR: service ${SERVICE_NAME} is not installed."
  exit 2
fi

if ! systemctl list-unit-files --type=timer --no-legend | awk '{print $1}' | rg -q "^${TIMER_NAME}$"; then
  echo "ERROR: timer ${TIMER_NAME} is not installed."
  exit 2
fi

timer_enabled="$(systemctl is-enabled "${TIMER_NAME}" || true)"
timer_active="$(systemctl is-active "${TIMER_NAME}" || true)"
service_active="$(systemctl is-active "${SERVICE_NAME}" || true)"

if [[ "${timer_enabled}" != "enabled" ]]; then
  echo "ERROR: ${TIMER_NAME} is not enabled (current: ${timer_enabled})."
  exit 2
fi

if [[ "${timer_active}" != "active" ]]; then
  echo "ERROR: ${TIMER_NAME} is not active (current: ${timer_active})."
  exit 2
fi

# oneshot services are usually "inactive" between runs; that's expected.
if [[ "${service_active}" == "failed" ]]; then
  echo "ERROR: ${SERVICE_NAME} is currently failed."
  systemctl --no-pager --full status "${SERVICE_NAME}" || true
  exit 2
fi

last_finish_us="$(systemctl show "${SERVICE_NAME}" -p ExecMainExitTimestampUSec --value || true)"
last_code="$(systemctl show "${SERVICE_NAME}" -p ExecMainStatus --value || true)"
result="$(systemctl show "${SERVICE_NAME}" -p Result --value || true)"

if [[ -z "${last_finish_us}" || "${last_finish_us}" == "0" ]]; then
  echo "ERROR: ${SERVICE_NAME} has no completed run yet."
  exit 2
fi

now_s="$(date +%s)"
last_s="$(( last_finish_us / 1000000 ))"
age_minutes="$(( (now_s - last_s) / 60 ))"

if (( age_minutes > MAX_AGE_MINUTES )); then
  echo "ERROR: last successful completion is stale (${age_minutes} minutes ago; max ${MAX_AGE_MINUTES})."
  exit 2
fi

if [[ "${result}" != "success" || "${last_code}" != "0" ]]; then
  echo "ERROR: last run result is not healthy (result=${result}, exit=${last_code})."
  exit 2
fi

echo "OK: ${SERVICE_NAME} healthy | timer=${timer_active}/${timer_enabled} | last_run_age=${age_minutes}m | result=${result}"
