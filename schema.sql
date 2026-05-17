-- ─── ABCP TRACKER — SUPABASE SCHEMA ─────────────────────────────────────────
-- Run this entire file in your Supabase SQL Editor

-- Users (synced from Whoop OAuth)
CREATE TABLE IF NOT EXISTS users (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whoop_user_id     TEXT UNIQUE NOT NULL,
  email             TEXT,
  first_name        TEXT,
  last_name         TEXT,
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Daily food logs
CREATE TABLE IF NOT EXISTS food_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whoop_user_id   TEXT NOT NULL REFERENCES users(whoop_user_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  meal            TEXT, -- 'breakfast', 'lunch', 'snack', 'dinner', 'other'
  calories        INTEGER NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS food_logs_user_date ON food_logs(whoop_user_id, date);

-- Body measurements (weight + waist — logged weekly)
CREATE TABLE IF NOT EXISTS body_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whoop_user_id   TEXT NOT NULL REFERENCES users(whoop_user_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  weight_lbs      NUMERIC(5,1),
  waist_inches    NUMERIC(4,1),
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(whoop_user_id, date)
);
CREATE INDEX IF NOT EXISTS body_logs_user_date ON body_logs(whoop_user_id, date);

-- Workout completions (which exercises done each session)
CREATE TABLE IF NOT EXISTS workout_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whoop_user_id   TEXT NOT NULL REFERENCES users(whoop_user_id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  day_name        TEXT, -- 'Tuesday', 'Wednesday', etc
  exercises_done  TEXT[], -- array of exercise IDs completed
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (keeps data private per user)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
