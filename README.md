# budget-friend
A website to make budgets easier!

## Reason behind this project

I want to get better at tracking my budget, but sitting down and manually
categorizing every expense is annoying.

## Goal

Create a site that takes in debit/credit card statements and returns cleanly
formatted data on how I spent money — with categorization that doesn't
require re-doing the same manual work every month.

## Tech stack

- **Frontend:** React (component-based, potential for React Native later)
- **Backend:** Express.js, with a Python script for PDF parsing (communication
  via stdin/stdout using child processes)
- **Database:** PostgreSQL — stable schema, relationships (Users → Categories
  → Transactions), supports the queries this app needs
- **API:** REST
- **File handling:** Multer, in-memory buffers only (no disk writes), files
  discarded immediately after parsing — no sensitive info (account/card
  numbers) is ever stored

## v1 — functional for personal use

v1 is scoped to be usable by me, locally, as fast as possible. No
deployment, no real auth — everything runs on `localhost` against the
existing hardcoded single-user row.

**Core loop:**
- Upload an RBC debit statement (single format for now) → parsed → checked
  for duplicates against already-uploaded periods → persisted.
- View the current month's transactions (archive/past-months browsing is a
  v2 feature — the `month`/`year` filters already exist to make that cheap
  later).

**Categorization:**
- Manual categorization via an inline dropdown per transaction.
- Merchant memory: once a merchant is categorized, future transactions from
  that merchant auto-apply the same category.
- A hardcoded default set of categories ships with the app (Groceries,
  Dining, Transport, Bills, Shopping, Income, Other, etc.). Custom
  categories are supported by the backend, but there's no "add category" UI
  yet — add one via the API/SQL directly if needed.

**Data integrity:**
- Duplicate-upload protection, so re-uploading the same statement doesn't
  double-insert transactions.
- `PATCH`/`DELETE` on a transaction, to fix parser mistakes (merchant,
  amount, description) or remove a bad row — the same endpoint also handles
  category assignment.

**Frontend:**
- A single page: upload control, a summary strip (total spent, total by
  category), and the current month's transaction list with an inline
  category dropdown and edit/delete per row.

## Future additions (post-v1)

- Multi-bank/format parser templates — the parser currently only handles
  RBC debit statements; other banks/cards will need their own column
  templates.
- Archive view — browsing past months, not just the current one.
- Real authentication (Clerk) and deployment/hosting, so the app is usable
  outside `localhost`.
- "Add category" UI, instead of requiring direct DB/API access.
- Smarter auto-categorization — e.g. a rules engine (regex/pattern-based)
  beyond simple merchant memory.
