# Maintainers Guide: Database Dumps

This guide describes how and when to create new PostgreSQL database dumps for the Qafiyah project.

## Prerequisites

- A recent PostgreSQL installed locally (the `pg_dump` binary's major version should be at least the production server's)
- Direct network access to the production database host, or an SSH tunnel/VPN if the host is not publicly accessible
- Sufficient local disk space for the compressed dump

## When to Create a New Dump

Create a new dump when any of the following conditions are met:

- The database schema changes (new columns, tables, or indexes added or removed)
- A significant data quality pass has been completed
- The verse or poem count changes by more than ~1,000 records
- At least 30 days have elapsed since the previous dump

## Naming Convention

1. Determine the next sequence number by listing existing dump directories:
   ```bash
   ls dumps/ | sort | tail -1
   ```
2. Create a new directory named `{N+1:04d}_{DD}_{MM}_{YYYY}`, for example, `0004_15_05_2026`.
3. Run `pg_dump` with the output file named `qafiyah_public_{YYYYMMDD}_{HHMMSS}.dump` inside that directory.

## Pre-Dump: Populate Derived Tables

Some tables contain precomputed data that must be refreshed before each dump.
Run these scripts **before** `pg_dump`:

```bash
# Recompute 5 related poems per poem (poem_relations table)
psql -h <PROD_DB_HOST> -U qafiyah -d qafiyah \
  -f scripts/sql/populate_related_poems.sql
```

This script is idempotent (TRUNCATE + INSERT) and runs quickly.

## Create a Dump

```bash
pg_dump \
  -h <PROD_DB_HOST> \
  -p 5432 \
  -U qafiyah \
  -d qafiyah \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  -Fc \
  -f qafiyah_public_$(date +%Y%m%d_%H%M%S).dump
```

Replace `<PROD_DB_HOST>` with the actual production database hostname or IP address.

## Post-Dump Checklist

After creating a new dump:

- [ ] Verify the dump file is non-empty:
  ```bash
  ls -lh dumps/{new-dir}/
  ```
- [ ] Restore locally to confirm integrity:
  ```bash
  bun run db:reset
  psql -U qafiyah -d qafiyah -h 127.0.0.1 -p 5433 -c "SELECT count(*) FROM poems;"
  ```
- [ ] Update the dataset statistics table in `dumps/README.md` if counts have changed.
- [ ] Commit the new directory and updated README:
  ```bash
  git add dumps/
  git commit -m "chore(dumps): add {new-dir} snapshot"
  ```
- [ ] Push to the remote repository so external users can access the new dump.
- [ ] After the new dump is deployed to production, refresh Elasticsearch with `bun run reindex` (the worker only auto-reindexes when the alias is empty, so an in-place data change needs a manual reindex).

## Reference

See [dumps/README.md](./README.md) for restore instructions.
