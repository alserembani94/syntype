-- The leaderboard's tables (docs/leaderboard.md, "Data model").
-- Applied with `wrangler d1 migrations apply syntype` (--local or --remote).

-- One row per signed-in player. No email, avatar or IP address is stored.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
  -- The provider's permanent user id (GitHub's numeric id, Google's "sub").
  provider_id TEXT NOT NULL,
  -- Null until the player confirms a name; nothing is shown before that.
  name TEXT,
  -- lower(name): names are unique whatever their case.
  name_key TEXT UNIQUE,
  -- Prefilled in the name step: the GitHub username, or a Google first name plus digits.
  suggested_name TEXT NOT NULL,
  name_changed_at TEXT,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  -- Bumped to sign the player out everywhere (account deletion, a forced sign-out).
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (provider, provider_id)
);

-- Every snippet text ever played. Editing a snippet makes a new fingerprint,
-- and so a new board; the old one is archived with its text kept for replays.
CREATE TABLE snippet_versions (
  fingerprint TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  name TEXT NOT NULL,
  length TEXT NOT NULL CHECK (length IN ('short', 'medium', 'long')),
  code TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX snippet_versions_by_language ON snippet_versions (language, name);

-- Each player's best on each snippet version: one row per typing-aid
-- combination they used ('110' = auto-indent on, auto-close on, autocomplete
-- off), and one 'any' row, their overall best, for the default board.
CREATE TABLE bests (
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL REFERENCES snippet_versions (fingerprint),
  aids TEXT NOT NULL CHECK (aids = 'any' OR aids GLOB '[01][01][01]'),
  language TEXT NOT NULL,
  run_id TEXT NOT NULL,
  wpm REAL NOT NULL,
  raw_wpm REAL NOT NULL,
  accuracy REAL NOT NULL,
  seconds REAL NOT NULL,
  -- The run's own aids (on an 'any' row, which combination the best was typed with).
  run_aids TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  PRIMARY KEY (player_id, fingerprint, aids)
);
-- A board: one snippet version and aid filter, fastest first; ties go to
-- higher accuracy, then whoever got there first.
CREATE INDEX bests_board ON bests (fingerprint, aids, wpm DESC, accuracy DESC, finished_at);
CREATE INDEX bests_by_language ON bests (language, fingerprint);

-- Keystroke logs, kept only for each board's top 20 (top 15 shown).
CREATE TABLE logs (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  log BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX logs_by_fingerprint ON logs (fingerprint);

-- Reports from signed-in players, about a run or a player.
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  -- Kept but anonymised (null) when the reporter deletes their account.
  reporter_id TEXT REFERENCES players (id) ON DELETE SET NULL,
  target_player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  target_run_id TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('cheating', 'name', 'other')),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL,
  UNIQUE (reporter_id, target_player_id, target_run_id)
);
CREATE INDEX reports_by_status ON reports (status, created_at);

-- Every moderation action, for the record.
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_player_id TEXT,
  target_run_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
