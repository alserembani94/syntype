-- Moderation (docs/leaderboard.md, "Moderation").

-- Hidden by the admin, apart from the player's own "hide me": a player can show
-- themselves again, but not undo a moderator's hide.
ALTER TABLE players ADD COLUMN moderator_hidden INTEGER NOT NULL DEFAULT 0 CHECK (moderator_hidden IN (0, 1));

-- Which admin took the action (their Cloudflare Access email).
ALTER TABLE admin_actions ADD COLUMN admin TEXT;
CREATE INDEX admin_actions_by_time ON admin_actions (created_at);

-- Reports about a player, for the queue and the daily limit.
CREATE INDEX reports_by_target ON reports (target_player_id, target_run_id);
CREATE INDEX reports_by_reporter ON reports (reporter_id, created_at);
