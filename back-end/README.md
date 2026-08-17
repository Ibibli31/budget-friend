# back-end

## Layout

- `src/` — Express API (`index.js`, `db.js`, `config.js`, `routes/`)
- `parser/` — Python PDF-statement parser and its own venv/tests
- `tests/` — JS integration tests for the API, run against a real Postgres test db
- `db/` — Postgres schema (`schema.sql`, `migrations/`)

## Database setup

Requires **PostgreSQL 15 or newer** — the transactions dedupe constraint uses
`UNIQUE NULLS NOT DISTINCT`, which older versions reject with a syntax error.

1. Create the database and apply the schema, then the migrations `schema.sql`
   does not already include:
   ```
   psql -d budget_friend -f db/schema.sql
   psql -d budget_friend -f db/migrations/0002_seed_default_categories.sql
   psql -d budget_friend -f db/migrations/0003_unique_category_name_per_user.sql
   ```
   `schema.sql` is the current table shape, so `0001` and `0004` are already
   baked into it — running them on a fresh database will fail. `0002` and
   `0003` are not, so a fresh database needs them.

   **Upgrading a database created before 2026-08-16** — run `0004` on it:
   ```
   psql -d budget_friend -f db/migrations/0004_unique_transaction_per_upload.sql
   ```
   Without it every upload returns 500: the route names
   `transactions_dedupe_unique` directly. Apply it to `budget_friend_test` too,
   or the upload tests fail.
2. Seed the single hardcoded user (v1 has no auth — every persisted
   transaction and read is scoped to this one row):
   ```
   psql -d budget_friend -c "INSERT INTO users (username, email, first_name, last_name) VALUES ('default', 'default@budgetfriend.local', 'Default', 'User') RETURNING id;"
   ```

## Environment variables

Connection is configured via the standard `pg` environment variables
(`DATABASE_URL`, or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `PG*` | Postgres connection, read by `src/db.js` via `pg`'s defaults |
| `DEFAULT_USER_ID` | id of the seeded user row from step 2 above; read via `src/config.js` |

## Duplicate uploads

Re-uploading a statement that overlaps one already imported skips the rows
already stored and imports only the new ones, reporting both counts.

A row is identified by `(user_id, source, date, amount, merchant, description,
occurrence)`, enforced by the `transactions_dedupe_unique` constraint. Each
insert uses `ON CONFLICT DO NOTHING`, so a collision skips that row instead of
failing the whole statement. `NULLS NOT DISTINCT` is required because
`description` is nullable — without it, rows with no description never collide
and would duplicate on every upload.

`occurrence` exists because a statement can legitimately list the same
date/amount/merchant/description twice — two $20 ATM withdrawals on one day —
with nothing else to tell them apart. `src/statementRows.js` numbers repeats
within a statement 1, 2, 3..., so both rows persist. Re-uploads still
deduplicate because the same statement always numbers the same way.

The one gap: numbering only lines up if both uploads contain the whole day. A
statement boundary splitting a day across two PDFs would number each half's row
as 1 and wrongly skip the second. RBC statements run on a fixed monthly cycle,
so this needs a custom date range to happen.

## Shared modules

- `src/db.js` — shared `pg` `Pool`, `query()`, and `transaction()` helpers used by routes. Also registers the `pg` type parsers that return `DATE` as a `YYYY-MM-DD` string and `BIGINT` as a number, so ids and dates serialize as JSON numbers and plain dates.
- `src/config.js` — exports `DEFAULT_USER_ID`, the hardcoded user id for v1.
- `src/statementRows.js` — turns parsed statement rows into the columns `transactions` stores.

## Tests

```
npm test        # python pdf parser tests (parser/tests)
npm run test:js # node:test integration tests against a real Postgres test db (needs PGDATABASE=budget_friend_test reachable)
```
