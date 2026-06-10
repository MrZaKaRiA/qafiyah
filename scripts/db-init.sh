#!/usr/bin/env bash
set -euo pipefail

dump="$(find /dumps -name '*.dump' -type f | sort -r | head -1)"
if [[ -z "${dump}" ]]; then
  echo "[db-init] no .dump found in /dumps, starting with an empty database" >&2
  exit 0
fi

echo "[db-init] restoring ${dump} into ${POSTGRES_DB}..."
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;'
pg_restore --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --format=custom --no-owner --no-acl "${dump}"
echo "[db-init] restore complete"
