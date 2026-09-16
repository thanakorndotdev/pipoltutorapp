-- Runs once, on first boot of an empty postgres data volume.
-- Table definitions belong in drizzle migrations; keep this to extensions
-- and anything a migration cannot create itself.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
