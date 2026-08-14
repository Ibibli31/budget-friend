-- Prevents a user from creating two categories with the same name. NULL
-- user_id (default categories) is exempt since Postgres treats NULLs as
-- distinct in a unique index, which is what we want here.
ALTER TABLE categories
  ADD CONSTRAINT categories_user_id_name_unique UNIQUE (user_id, name);
