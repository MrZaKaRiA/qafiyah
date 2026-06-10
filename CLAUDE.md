# CLAUDE.md

**Qafiyah**: Arabic poetry monorepo (Bun + Turborepo).

## Packages

| Package               | Stack                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| `apps/web`            | Astro SSR (@astrojs/node + Bun), React islands, Tailwind, TanStack Query    |
| `apps/api`            | Hono + oRPC + Valibot, Bun server (Docker), OpenAPI                         |
| `apps/bot`            | X/Twitter bot via `twitter-api-v2`, GitHub Actions cron                     |
| `apps/worker`         | Postgres→Elasticsearch sync (boot reindex + weekly reconcile), Bun/Docker   |
| `packages/db`         | Drizzle + PostgreSQL (API + worker reads; no search logic)                  |
| `packages/search`     | Elasticsearch: client, Arabic analyzers/mappings, query + reindex/reconcile |
| `packages/contracts`  | Shared oRPC contracts (Valibot)                                             |
| `packages/constants`  | Brand/URLs/ports                                                            |
| `packages/typescript` | Shared tsconfigs                                                            |

## Commands

```bash
bun run dev             # seeded PG + ES + worker (Docker) + hot-reload web & API
bun run up / down       # full stack in Docker (self-seeds first boot) / stop
bun run db:up           # seeded Postgres only (:5433)
bun run db:reset        # wipe DB volume + re-seed from latest dump
bun run es:up / es:down # Elasticsearch only (:9200)
bun run reindex         # rebuild ES index from PG (alias swap)
bun run deploy          # prod deploy: sync VPS to origin/main + rebuild
bun run build / lint / format / types / test
bun run clean           # kill orphan astro/api-server processes
bun run ci              # format + lint + types + test + knip + madge + audit + smoke

bun --filter @qafiyah/api run dev|test
vitest run path/to/file.test.ts
```

## Tooling

- **Biome**: JS/TS lint+format, 2-space, 100-char, single quotes, es5 commas
- **Prettier**: `.md`/`.mdx` only
- **Commitlint**: Conventional Commits (`feat`, `fix`, `refactor`, …)
- **knip** + **madge**: unused exports + circular imports (CI only)
- **envin**: type-safe env via `src/env.ts`; fails at boot on bad/missing vars

## Architecture

**`apps/web`**, On-demand SSR (`output: 'server'`, `@astrojs/node` standalone under Bun). Every route renders per request, fetching the internal `api` container via oRPC.

- Server-only accessors in `src/lib/server/*` (`apiServer` → `INTERNAL_API_URL`); `errorStatus` maps API HTTP errors to 404 (API serializes Problem+JSON, oRPC client exposes only status-mapped errors; poem endpoint returns 500 when missing).
- Per-page `Cache-Control` TTL. No DB access, no snapshot.
- `PUBLIC_API_URL` points browser islands at prod (falls back to prod when unset).
- Dynamic sitemaps under `src/pages/sitemap*`. React islands-only. Alias `@/*`→`src/*`. RTL. Non-trailing-slash canonical URLs.

**Web deploy**, VPS + Docker (`docker compose up -d --build`).

- Image bundles nginx (proxy_cache + static serving + www→apex/trailing-slash canonicalization) in front of Bun SSR, **fully non-root** (nginx on `8080`); `INTERNAL_API_URL=http://api:8787`.
- Compose binds all published ports to `127.0.0.1` (Cloudflare Tunnel fronts everything); host `:80`→container `:8080`.
- Prod creds from gitignored `.env` (see `.env.example`); dev uses built-in defaults.
- nginx serves cached HTML on hits, `/_astro/` immutably; TTL-based freshness (no rebuild for new poems).

**`apps/api`**, Thin Hono over `@qafiyah/db`. Entrypoint `src/server.ts`; reads `DATABASE_URL`/`PORT`/`ENVIRONMENT` from `process.env`.

- No Drizzle/postgres imports in `apps/api/src`.
- Procedures in `src/procedures/*.procedures.ts` → `src/router.ts` → `OpenAPIHandler`. `/poems/random` and `/` are raw Hono routes.
- Long-lived Bun process as non-root `bun` user, multi-stage devDep-pruned image (per-process db-cache in `db.middleware.ts` shared across requests). No API code ships to browser.

**`packages/db`**, Namespaces: `eras/meters/poems/poets/rhymes/indexing/themesQueries`. Factory `createDb(url)`.

- `indexingQueries` (`streamPoemBatch`/`streamPoetBatch`/`getPoemsBySlugs`/`getPoetsBySlugs`) feed the worker's ES reindex/reconcile.
- Consumers: `apps/api`, `apps/worker`. No search logic, that's ES via `@qafiyah/search`.

**`packages/search`**, Postgres-free ES layer.

- `createSearchClient` forces `Connection: HttpConnection` (default undici transport breaks under Bun).
- Explicit Arabic mappings/analyzers (diacritic strip + alef/ya/ta-marbuta folding + stemming), document mappers, boosted query builders (filters as cacheable `bool.filter`).
- Admin primitives: `ensureIndex`/`bulkIndex`/`swapAlias`/`reindexFromSource`/`reconcileFromSource`. Consumed by `apps/api` (query) + `apps/worker` (sync).

**`apps/api` search**, `/v1/search` queries ES (never PG) via cached `es` middleware; returns grouped `{ q, poems, poets }` with per-section pagination, both queried in parallel.

**`apps/worker`**, Long-lived Bun container: reads PG (`@qafiyah/db`), syncs to ES (`@qafiyah/search`).

- Boot reindex if alias empty; weekly reconcile. Exposes `/healthz` + authenticated `/reconcile`.
- No outbox; read-only/dump-shipped dataset → sync = bulk reindex on deploy + weekly drift repair.
- Started by `bun run dev` as ES's seeder (boot reindex-if-empty = ES analog of `db-init.sh`). Host dev API reaches ES via `qafiyah-es.orb.local:9200` (OrbStack resets published `localhost:9200`).

**`apps/bot`**, Cron 08/12/16/20 UTC (11/15/19/23 KSA). Calls `/poems/random`, posts via `twitter-api-v2`. Exponential backoff, 3 retries.

**`packages/constants`**, Always update brand strings, URLs, ports here (`DEV_WEB_PORT=4321`, `DEV_API_PORT=8787`), never in app code.

## CI Workflows

- `ci.yml`: format, lint, types, test, knip, madge, audit
- `post-poem.yml`: bot cron
- `reconcile.yml`: weekly PG↔ES reconcile (POSTs worker's `/reconcile`)
- `gitleaks.yml`: secret scanning on push/PR

## Session Discipline

- **One mission per session.**
- Port conflicts → `bun run clean`, restart.
- DB dumps in `dumps/` (newest = latest); see `dumps/MAINTAINERS_GUIDE.md`.
- **Web build is `astro build` only (~seconds), no snapshot.** SSR needs `api` (+ DB) up; `bun run dev` starts both. Verify with `astro dev` + curl against seeded DB (`bun run db:up`).

## Quality Checklist (TRUST 5)

|       | Criterion | Gate                                          |
| ----- | --------- | --------------------------------------------- |
| **T** | Tested    | `bun run test` passes; new logic has coverage |
| **R** | Readable  | 0 lint errors; self-explanatory names         |
| **U** | Unified   | Biome config + Conventional Commits           |
| **S** | Secured   | No secrets; inputs validated at boundaries    |
| **T** | Trackable | Commit message explains _why_                 |

## Code Annotations (use sparingly)

```ts
// @ANCHOR: <why>   (3+ callers depend on this contract)
// @WARN: <danger>  (async side-effect, global mutation)
// @NOTE: <context> (magic constant, workaround)
```

## Known Denormalizations

`apps/web/src/constants.ts` hardcodes `ERAS_OPTIONS`, `METERS_OPTIONS`, `RHYMES_OPTIONS` (one per qafiyah letter), `THEMES_OPTIONS`, `COLLECTIONS_OPTIONS`, mirroring the `/v1/{eras,meters,rhymes,themes,collections}` endpoints. Powers the filter UI without a runtime fetch; **regenerate by hand when domain rows are added.**

## Known Bug

Old `@astrojs/compiler` releases crash on `"` inside `${}` in Astro templates. Workaround: use helper functions, not inline quoted strings. Remove if no longer reproducible.

> See `AGENTS.md` for per-file coding standards (TS dialect, logic, naming, errors, testing).
