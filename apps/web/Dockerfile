# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/constants/package.json packages/constants/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript/package.json packages/typescript/package.json
COPY packages/search/package.json packages/search/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run --filter @qafiyah/web build

FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/constants/package.json packages/constants/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/typescript/package.json packages/typescript/package.json
COPY packages/search/package.json packages/search/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts --linker hoisted
COPY packages ./packages

FROM oven/bun:1.3.14-alpine AS serve
RUN apk add --no-cache nginx tini
WORKDIR /app
COPY --from=build     /app/apps/web/dist  ./apps/web/dist
COPY --from=prod-deps /app/node_modules   ./node_modules
COPY --from=prod-deps /app/packages       ./packages
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/nginx-security-headers.conf /etc/nginx/nginx-security-headers.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
    && mkdir -p /var/cache/nginx/astro \
    && chown -R nginx:nginx /var/cache/nginx
ENV NODE_ENV=production HOST=127.0.0.1 SSR_PORT=4321
EXPOSE 8080
USER nginx
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
