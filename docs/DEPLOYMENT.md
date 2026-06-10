# Deployment

> **Single source of truth.** This file (`docs/DEPLOYMENT.md`) is canonical and lives in the repo. On the production host you read the checked-out copy at `/opt/qafiyah/docs/DEPLOYMENT.md`, which every deploy refreshes (`git reset --hard origin/main`), so there's nothing to sync by hand: edit here, commit, deploy.
>
> **This repo is public, keep this file secret-free.** No credentials, tokens, real public IPs, or Cloudflare Tunnel IDs. Document _where_ secrets live (the gitignored `.env`), never their values; read host-specific identifiers off the live box (e.g. `cloudflared tunnel list`) instead of committing them here.

## About this document

Production deployment of Qafiyah, it doubles as the on-box operator runbook. This is **not** a local development guide; use `bun run dev` for that. The **api, worker, and web** deploy together (alongside Postgres and Elasticsearch) via Docker Compose on a single VPS; the **bot** runs in GitHub Actions. Push-button deploy: `bun run deploy` syncs the host to `origin/main` and rebuilds the stack.

The host is a single small Linux VPS fronted by Cloudflare. **The only thing reachable from the internet is SSH**, the web and API are served outbound-only through a Cloudflare Tunnel, and every container port binds to `127.0.0.1`.

## How traffic gets in

```
                         ┌─ qafiyah.com / www  ─┐
  Internet ──► Cloudflare edge (TLS) ──► Cloudflare Tunnel ──► cloudflared (host)
                         └─ api.qafiyah.com    ─┘                      │
                                                       ┌──────────────┴───────────────┐
                                                       ▼                              ▼
                                            127.0.0.1:80  (web/nginx)      127.0.0.1:8787 (api)
```

- `cloudflared` runs as a **systemd service** and dials _out_ to Cloudflare, there is **no inbound 80/443** on the host.
- Routing lives in `/etc/cloudflared/config.yml`: `qafiyah.com` + `www.qafiyah.com` → `localhost:80`, `api.qafiyah.com` → `localhost:8787`, the worker's reconcile hostname → `localhost:8088`, everything else → 404. (Run `cloudflared tunnel list` on the host for the tunnel name/id, not recorded here.)

## The stack (`/opt/qafiyah`, `docker compose`, 5 containers)

| Container        | Role                               | Host bind (loopback only) | Public?    |
| ---------------- | ---------------------------------- | ------------------------- | ---------- |
| `qafiyah-web`    | Astro SSR + nginx (front)          | `127.0.0.1:80`            | via tunnel |
| `qafiyah-api`    | Hono / oRPC API (mounted at `/v1`) | `127.0.0.1:8787`          | via tunnel |
| `qafiyah-db`     | PostgreSQL 18                      | `127.0.0.1:5433`          | **no**     |
| `qafiyah-es`     | Elasticsearch 9 (search)           | `127.0.0.1:9200`          | **no**     |
| `qafiyah-worker` | Postgres → Elasticsearch sync      | `127.0.0.1:8088`          | **no**     |

- **DB self-seeds** on first boot from the newest dump in `dumps/` (only when the data volume is empty).
- **Worker** reindexes Elasticsearch on boot when the search index is empty, then reconciles weekly on its own timer. Its `/reconcile` endpoint is authenticated and not publicly exposed.

## Prerequisites (VPS)

1. **Docker + Docker Compose**, with the repo checked out on the host (at `/opt/qafiyah`).

2. **A root `.env` file.** Compose auto-loads it for `${VAR}` interpolation in `docker-compose.yml`. Copy the template and set real values:

   ```bash
   cp .env.example .env
   # edit POSTGRES_PASSWORD at minimum
   ```

   The API's `DATABASE_URL` is composed from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`. With no `.env` the `qafiyah` dev defaults apply, so **set a real `POSTGRES_PASSWORD` for production.** (Local dev needs no `.env`; the defaults are intended.)

3. **Cloudflare Tunnel** (or equivalent) for ingress and TLS. Every published port binds to **`127.0.0.1`** (nothing answers on the public interface), so the tunnel must reach the services over loopback:
   - web → `http://127.0.0.1:80`
   - api (`api.qafiyah.com`, also called by the bot) → `http://127.0.0.1:8787`
   - worker (`/reconcile` + `/healthz`, called by the weekly reconcile workflow) → `http://127.0.0.1:8088`

## Bring up the stack & seeding

```bash
docker compose up -d --build   # or, from a dev machine: bun run deploy
```

Builds and starts `db` + `elasticsearch` + `api` + `worker` + `web`, gated on healthchecks: `db` and `elasticsearch` healthy → `api` and `worker` start; `api` healthy → `web`.

**First boot only:** on an empty data volume, Postgres auto-restores the newest dump from `dumps/` via `scripts/db-init.sh`. This can take a few minutes; the `db` healthcheck's `start_period` is 300s to cover it. Later boots reuse the volume. To wipe and re-seed locally: `bun run db:reset`.

> **Major-version bumps of `postgres` or `elasticsearch` need a volume wipe.** When `docker-compose.yml` jumps either image to a new **major** version (e.g. PG 17→18, ES 8→9), the new image refuses to boot on the existing volume's data, so `db` (or `elasticsearch`) crash-loops and the deploy's `--wait` never completes, `api`/`worker`/`web` then never start (they gate on a healthy `db`+`es`). Confirm via `docker compose logs db` / `logs elasticsearch` (a version/upgrade error). Because the dataset is read-only/dump-shipped, the fix is to wipe the affected volume and let it re-seed, the DB self-restores from `dumps/` and the worker rebuilds Elasticsearch from Postgres:
>
> ```bash
> docker compose down                               # no -v
> docker volume rm qafiyah-db-data qafiyah-es-data  # only the bumped store(s) strictly need wiping
> docker compose up -d --build --wait
> ```
>
> This is only safe while production stays read-only/dump-shipped. Once it takes real writes, use `pg_upgrade` instead of wiping `qafiyah-db-data`.

## Deploying (push-button)

Deploys are **manual**, there is no auto-deploy timer. From a **dev machine** that has the repo checked out and SSH access to the host:

```bash
bun run deploy        # scripts/deploy.sh
```

It SSHes to the host and runs, in `/opt/qafiyah`:

```bash
git fetch --depth 1 origin main
git reset --hard FETCH_HEAD
docker compose up -d --build --remove-orphans --wait
docker compose ps
```

Volumes persist (no data loss) and a failed build leaves the running stack untouched. **`bun` is not installed on the host**, the `bun run …` scripts are for a dev machine; to act directly on the box, use raw `docker compose` (see Common operations). **Exception:** a stateful major-version bump won't boot on the old volumes, see the major-version-bump note under _Bring up the stack & seeding_.

## Common operations (run on the host, from `/opt/qafiyah`)

```bash
docker compose ps                       # status of all containers
docker compose logs -f web              # tail logs (web | api | worker | db | elasticsearch)
docker compose restart web              # restart one service
docker compose down                     # stop the stack (keeps data volumes)
docker compose up -d                    # start the stack

# Update to latest code and rebuild (on-host equivalent of `bun run deploy`):
git fetch origin main && git reset --hard origin/main
docker compose up -d --build --wait

# Cloudflare Tunnel:
systemctl status cloudflared
cloudflared tunnel list                 # tunnel name / id / health

# Worker:
curl http://127.0.0.1:8088/healthz      # liveness
# manual reconcile (token read from the gitignored .env, value never stored here):
curl -X POST -H "Authorization: Bearer $(grep RECONCILE_TOKEN .env | cut -d= -f2)" \
     http://127.0.0.1:8088/reconcile

# DANGER, wipe DB + ES volumes and re-seed from the dump on next boot:
# docker compose down -v && docker compose up -d
```

## Security posture

- **Only SSH is reachable from the internet.** Web/API egress through the Cloudflare Tunnel, and **every container port binds to `127.0.0.1`**, so the database, Elasticsearch, and worker are never publicly exposed. If you ever publish a port on `0.0.0.0`, Docker punches through the firewall, keep binds on loopback.
- The host runs a standard hardening baseline: default-deny inbound firewall (only SSH allowed), key-only SSH with brute-force banning, automatic security updates, and swap so builds/ES/Postgres don't OOM. Exact rules live on the box, not in this public file.
- Quick exposure check on the host: `ss -tulpn | grep -v 127.0.0.1` should show only SSH on a public address; `ufw status verbose` for the firewall.

## Secrets

- The production `.env` (at `/opt/qafiyah/.env`, mode `600`, **gitignored**) holds `POSTGRES_PASSWORD` and `RECONCILE_TOKEN`, the only place those values live. Never commit them, and never paste values into this document.
- `RECONCILE_TOKEN` is also a GitHub Actions secret (used by the weekly reconcile workflow). The bot's credentials are GitHub Actions secrets only (see Bot).

## API (`apps/api`)

Bun + Hono server (`apps/api/Dockerfile`): a multi-stage, devDependency-pruned image that runs **non-root** (the `bun` user) with `tini` as PID 1. It reads `DATABASE_URL` / `ELASTICSEARCH_URL` / `ENVIRONMENT` / `PORT` from `process.env` (injected by compose). The healthcheck hits `GET /v1/docs`, a 200 that never touches the DB. Published on `127.0.0.1:8787`.

## Web (`apps/web`)

Astro **server (SSR)** app. Every route renders on demand by calling the internal `api` container via the oRPC contract (`INTERNAL_API_URL=http://api:8787`); nginx (bundled in the image) caches the rendered HTML and serves built static assets from disk. `PUBLIC_API_URL` is unset, so browser islands fall back to the production API.

The image build runs `astro build` only (**no `DATABASE_URL` at build time**). The serve image is **fully non-root**: nginx and the Bun SSR origin both run as the `nginx` user under `tini`. nginx listens on **8080**, and compose maps host `127.0.0.1:80` → container `8080`. The entrypoint runs both processes and **exits if either dies**, so `restart: unless-stopped` recovers a crashed origin. Build just this image with `docker compose build web`.

### Caching & freshness

Each route sets a `Cache-Control` TTL (poems 24h; collection lists/indexes 1h; sitemaps 24h; the 404 is `no-store`). nginx (`proxy_cache`) honors it, collapses concurrent misses (`proxy_cache_lock`), and serves stale on upstream errors or during background refresh. New or edited poems appear within the TTL; no rebuild needed. nginx also canonicalizes URLs to the https apex (www→apex and trailing slashes), sets baseline security headers, gzips text responses, and serves `/_astro/` immutably.

### Sitemap

`/sitemap-index.xml` is generated on demand (poems sharded at 45k URLs/file, plus poets and collection landing pages) and cached like any other route. `public/robots.txt` references it.

### nginx & TLS

The full config is checked in at `apps/web/nginx.conf` and baked into the image at `/etc/nginx/nginx.conf`. It proxies HTML to the Astro origin on `127.0.0.1:4321`, serves `/app/apps/web/dist/client` from disk, and answers a container-local `/healthz`. TLS is terminated upstream by Cloudflare; the config is plain HTTP on `8080` by design. Because TLS lives at the edge, `$scheme` here is always `http`: the www→apex redirect is its own `server` block hardcoding `https://qafiyah.com`, and same-host redirects (trailing slash) stay relative (`absolute_redirect off`) so the browser keeps its https (never an `http://` Location or a leaked `:8080`). Baseline security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`) live in `apps/web/nginx-security-headers.conf`, included at server scope and re-included in every `location` that sets its own headers (nginx drops inherited `add_header` there). The real visitor IP is restored from Cloudflare's `CF-Connecting-IP` header; `set_real_ip_from` trusts the Docker bridge ranges (`172.16.0.0/12`, plus `192.168.0.0/16` for Docker Desktop); this is safe because the loopback-bound published port admits only the local `cloudflared`. On first deploy, confirm restoration by checking that `docker logs qafiyah-web` shows real client IPs in the access log rather than the `172.x`/`192.168.x` bridge gateway.

## Elasticsearch & Worker (`apps/worker`)

Search is served from Elasticsearch, kept in sync with Postgres by `apps/worker`; both run in the same Compose stack, loopback-only. The worker reindexes on boot when the `poems`/`poets` aliases are empty and reconciles weekly; it exposes `/healthz` and an authenticated `/reconcile` on `127.0.0.1:8088`. The weekly `.github/workflows/reconcile.yml` POSTs `/reconcile` through the worker's Cloudflare Tunnel hostname (GitHub runners can't reach the loopback DB/ES directly). `RECONCILE_TOKEN` (set in the VPS `.env` and as a GitHub Actions secret) authenticates that call. See [Search Implementation](SEARCH_FEATURE_IMPLEMENTATION.md) for index design and the sync model.

## Bot (`apps/bot`)

The bot has no manual deploy step. It runs entirely inside GitHub Actions on a cron schedule.

**Schedule** (UTC): `0 8`, `0 12`, `0 16`, `0 20`, four times daily (11:00, 15:00, 19:00, 23:00 KSA).

The workflow (`.github/workflows/post-poem.yml`) checks out `main`, installs dependencies with Bun, and runs `bun run start` inside `apps/bot`. The bot calls `/poems/random` on the production API and posts the result to X/Twitter.

### Required secrets

Configure these in the repository's GitHub Actions secrets:

| Secret                  | Description                 |
| ----------------------- | --------------------------- |
| `TWITTER_APP_KEY`       | OAuth 1.0a app key          |
| `TWITTER_APP_SECRET`    | OAuth 1.0a app secret       |
| `TWITTER_ACCESS_TOKEN`  | Account access token        |
| `TWITTER_ACCESS_SECRET` | Account access token secret |

The workflow can also be triggered manually via `workflow_dispatch`.

## Gotchas

- **Loopback binds are deliberate**, see _Security posture_. Publishing on `0.0.0.0` would expose internal services through the firewall.
- **React version pin.** `apps/mobile` (Expo) pins `react@19.2.3`; the root `package.json` `overrides` forces `react`/`react-dom` to `19.2.3` repo-wide. Removing that override reintroduces a duplicate-React SSR crash on every web page.
- **Stale browser cache after deploy.** HTML is sent with `max-age=3600`; returning visitors may see the old build for up to an hour (a hard-refresh fixes it). Assets are content-hashed so they never collide.
- **Cloudflare is the DNS authority**, so DNS changes are instant, no registrar propagation wait.
- **Major-version bumps need a volume wipe**, see the note under _Bring up the stack & seeding_.

## See also

- `CLAUDE.md`, full architecture & package map
- `dumps/MAINTAINERS_GUIDE.md`, database dump workflow
- `docs/SEARCH_FEATURE_IMPLEMENTATION.md`, search index design & sync model
