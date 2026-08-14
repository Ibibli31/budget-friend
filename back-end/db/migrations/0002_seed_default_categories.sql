-- Seeds default categories (user_id IS NULL) so a new install has something
-- to categorize into immediately. Guarded so re-running this migration
-- doesn't duplicate rows.
INSERT INTO categories (name, user_id)
SELECT name, NULL FROM (VALUES
  ('Groceries'),
  ('Dining'),
  ('Transport'),
  ('Bills'),
  ('Shopping'),
  ('Income'),
  ('Other')
) AS defaults(name)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.name = defaults.name AND categories.user_id IS NULL
);
