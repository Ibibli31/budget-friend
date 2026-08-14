// Preloaded (via `node --require`) before any test file, so every module
// that reads these env vars — db.js, config.js — picks up the test target.
process.env.PGDATABASE = process.env.PGDATABASE || 'budget_friend_test';
process.env.DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '1';
