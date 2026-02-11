# budget-friend
A website to make budgets easier!

REASON behind this project
- I want to get better a tracking my budget but sitting down and looking at my expenses to categorizing everything is annoying

GOALS of this project
tldr
- Create a site that takes in debit/credit card statements and returns a cleanly formatted data on how spent money

features
- Allows you to give your debit/credit card statements to the app so it can collect your transactions of the month
- Allows you to see your transactions of the month
- Allows you to see how you spent money in the past months (keeps archive of past months)


TECH STACK
Frontend: React (component-based, potential for React Native later)

Backend: Express.js (lightweight, good documentation, familiar)
Node.js with Python script integration for PDF parsing
Communication via stdin/stdout using child processes

Database: SQL (PostgreSQL or MySQL - you haven't decided which yet)
Reasoning: stable schema, relationships (Users → Accounts → Transactions), complex queries

API: REST API (simple enough for your needs, scalable)

Authentication: Clerk (easy React integration, free tier, good docs)

File Handling:
Multer for file uploads (or native Express support)
Process files in memory buffers (no disk writes)
HTTPS for encrypted transit
Immediate deletion after parsing

PDF Parsing:
Python script (called from Node.js)
Receives data via stdin, outputs parsed transactions via stdout

Security approach:
HTTPS in transit
In-memory processing only
No storage of sensitive info (account numbers, card numbers)
Files deleted immediately after transaction extraction
