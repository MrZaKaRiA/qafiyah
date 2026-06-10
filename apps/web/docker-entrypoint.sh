#!/bin/sh
HOST="${HOST:-127.0.0.1}" PORT="${SSR_PORT:-4321}" bun /app/apps/web/dist/server/entry.mjs &
ssr=$!
nginx -g 'daemon off;' &
ngx=$!

trap 'kill -TERM "$ssr" "$ngx" 2>/dev/null' TERM INT

while kill -0 "$ssr" 2>/dev/null && kill -0 "$ngx" 2>/dev/null; do
  sleep 5
done

kill "$ssr" "$ngx" 2>/dev/null
exit 1
