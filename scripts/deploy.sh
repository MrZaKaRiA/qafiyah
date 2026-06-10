#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="qafiyah"

echo "→ Deploying origin/main to ${REMOTE_HOST} ..."

ssh "$REMOTE_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/qafiyah
git fetch --depth 1 origin main
current=$(git rev-parse --short HEAD)
target=$(git rev-parse --short FETCH_HEAD)
echo "  current ${current}  ->  target ${target}"
git reset --hard FETCH_HEAD
docker compose up -d --build --remove-orphans --wait
echo ""
echo "=== prod status ==="
docker compose ps
echo ""
echo "✓ deployed $(git rev-parse --short HEAD)"
REMOTE
