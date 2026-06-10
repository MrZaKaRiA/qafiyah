#!/usr/bin/env bash
set -euo pipefail

docker compose up -d --wait db elasticsearch worker

[[ -f apps/api/.env ]] || cp apps/api/.env.example apps/api/.env
[[ -f apps/web/.env ]] || cp apps/web/.env.example apps/web/.env

if [[ "$(docker info --format '{{.OperatingSystem}}' 2>/dev/null)" == OrbStack* ]]; then
  export ELASTICSEARCH_URL="http://qafiyah-es.orb.local:9200"
fi

exec turbo run dev --filter=@qafiyah/web --filter=@qafiyah/api
