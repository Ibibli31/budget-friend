# back-end

## Database setup

1. Create the database and apply the schema:
   ```
   psql -d budget_friend -f schema.sql
   ```
   New changes ship as numbered files in `migrations/`; apply any not yet
   reflected in your database in order, e.g.:
   ```
   psql -d budget_friend -f migrations/0001_add_transaction_source.sql
   ```
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
| `DATABASE_URL` / `PG*` | Postgres connection, read by `db.js` via `pg`'s defaults |
| `DEFAULT_USER_ID` | id of the seeded user row from step 2 above; read via `config.js` |

## Shared modules

- `db.js` — shared `pg` `Pool` and `query()` helper used by routes.
- `config.js` — exports `DEFAULT_USER_ID`, the hardcoded user id for v1.

## Tests

```
npm test        # python pdf parser tests
npm run test:js # node:test smoke test for db.js (needs a reachable Postgres)
```
