-- Automatic flags (docs/leaderboard.md, "Moderation"): a run far above the
-- player's own history goes to the report queue, marked as from Syntype
-- rather than a player. The run stays up until the admin decides.
ALTER TABLE reports ADD COLUMN source TEXT NOT NULL DEFAULT 'player' CHECK (source IN ('player', 'auto'));
