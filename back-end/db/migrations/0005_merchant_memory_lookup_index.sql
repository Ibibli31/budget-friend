-- serves the merchant lookup an upload runs per parsed row
CREATE INDEX transactions_merchant_memory_idx
  ON transactions (user_id, lower(btrim(merchant)), date DESC, id DESC)
  WHERE category_id IS NOT NULL;
