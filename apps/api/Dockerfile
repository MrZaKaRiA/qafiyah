# syntax=docker/dockerfile:1
# @NOTE: the prod install is monorepo-wide, so the runtime node_modules also
# carries the *prod* deps of apps/web + apps/bot. Bun has no stable per-package
# prod-install yet; dropping all devDependencies + unrelated source is the win.

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
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY apps/api ./apps/api
COPY packages ./packages

FROM base AS runtime
ENV PORT=8787
RUN apk add --no-cache tini
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages ./packages
COPY --from=prod-deps /app/apps/api ./apps/api
EXPOSE 8787
USER bun
WORKDIR /app/apps/api
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/v1/docs || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "src/server.ts"]
