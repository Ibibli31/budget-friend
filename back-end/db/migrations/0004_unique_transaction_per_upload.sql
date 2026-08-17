-- lets re-uploads skip rows already persisted
ALTER TABLE transactions
  ADD COLUMN occurrence SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_dedupe_unique
  UNIQUE NULLS NOT DISTINCT (user_id, source, date, amount, merchant, description, occurrence);
