-- Unused schema (code review, Nov 2026).
-- No query filters bests by language, and every new best wrote to this index for nothing.
DROP INDEX bests_by_language;
-- Archived boards are worked out from the current snippet files, so this was never set.
ALTER TABLE snippet_versions DROP COLUMN archived_at;
