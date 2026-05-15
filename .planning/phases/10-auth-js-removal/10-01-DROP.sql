-- Phase 10 / CLEAN-02 — Drop Auth.js tables in FK-reverse order.
--
-- DESTRUCTIVE: removes all rows in users, accounts, sessions, verificationTokens.
-- Pre-flight: confirm user_google_tokens has at least one row per active parent
-- BEFORE running this migration. Both parents will need to re-sign in immediately
-- after deploy regardless, but data loss in user_google_tokens would break GCal sync.
--
-- Run inside a transaction so a partial failure rolls back cleanly.
BEGIN;

DROP TABLE IF EXISTS "verificationTokens";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

COMMIT;
