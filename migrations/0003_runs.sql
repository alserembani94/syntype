-- Run tokens already used to submit a run (docs/leaderboard.md, "Submitting a
-- run"): each token submits once. Rows older than a day are pruned, since a
-- token is only valid for two hours.
CREATE TABLE used_run_tokens (
  id TEXT PRIMARY KEY,
  used_at TEXT NOT NULL
);
CREATE INDEX used_run_tokens_by_time ON used_run_tokens (used_at);
