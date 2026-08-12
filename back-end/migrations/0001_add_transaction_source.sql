-- Adds a `source` identifier to transactions (e.g. "rbc_debit", "rbc_credit")
-- and makes `created_at` self-populating on insert.
--
-- `source` has no sensible default, so this assumes `transactions` is empty
-- (true as of this migration). If rows exist by the time this runs, backfill
-- `source` before the ALTER or this will fail with a NOT NULL violation.
ALTER TABLE transactions
  ADD COLUMN source VARCHAR NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();
