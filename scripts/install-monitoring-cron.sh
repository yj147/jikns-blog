#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_CMD="0 * * * * cd ${PROJECT_ROOT} && bash scripts/collect-monitoring-data.sh >> ${PROJECT_ROOT}/monitoring-data/cron.log 2>&1"

existing_crontab=$(crontab -l 2>/dev/null || true)

if grep -Fq "scripts/collect-monitoring-data.sh" <<<"${existing_crontab}"; then
  echo "[monitoring-cron] Cron entry already present. No changes made."
else
  (echo "${existing_crontab}"; echo "${CRON_CMD}") | crontab -
  echo "[monitoring-cron] Installed hourly monitoring cron entry."
fi

echo "[monitoring-cron] Current crontab:" >&2
crontab -l >&2
