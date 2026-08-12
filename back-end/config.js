// v1 is single-user: no auth/login. All persisted transactions and reads are
// scoped to this one seeded `users` row. Set DEFAULT_USER_ID to that row's id.
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID
  ? Number(process.env.DEFAULT_USER_ID)
  : undefined;

module.exports = { DEFAULT_USER_ID };
