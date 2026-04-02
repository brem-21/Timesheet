-- Clock-It database schema
-- Run once on a fresh database (auto-applied by Docker on first start)

CREATE TABLE IF NOT EXISTS activity (
  id        SERIAL PRIMARY KEY,
  path      TEXT    NOT NULL,
  title     TEXT,
  timestamp BIGINT  NOT NULL,
  type      TEXT    NOT NULL CHECK (type IN ('page', 'api', 'browser'))
);

CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity (timestamp DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  text        TEXT    NOT NULL,
  source      TEXT    NOT NULL,
  created_at  BIGINT  NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'todo'   CHECK (status   IN ('todo', 'in-progress', 'done')),
  priority    TEXT    NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  assignee    TEXT,
  reports_to  TEXT,
  notes       TEXT,
  description TEXT,
  checklist   JSONB   NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS meetings (
  source   TEXT PRIMARY KEY,
  speakers TEXT[] NOT NULL DEFAULT '{}',
  date     TEXT   NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id           TEXT PRIMARY KEY,
  title        TEXT   NOT NULL,
  description  TEXT,
  target_date  TEXT,
  completed_at TEXT,
  status       TEXT   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  category     TEXT   NOT NULL CHECK (category IN ('technical', 'leadership', 'delivery', 'growth', 'communication', 'other')),
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS profdev (
  id             TEXT    PRIMARY KEY,
  title          TEXT    NOT NULL,
  type           TEXT    NOT NULL CHECK (type IN ('course', 'certification', 'book', 'workshop', 'conference', 'mentoring', 'presentation', 'shadowing', 'other')),
  provider       TEXT,
  completed_date TEXT    NOT NULL,
  duration_hours NUMERIC,
  notes          TEXT,
  skills         TEXT[]  NOT NULL DEFAULT '{}',
  created_at     BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id       TEXT   PRIMARY KEY,
  saved_at BIGINT NOT NULL,
  summary  JSONB  NOT NULL
);

CREATE TABLE IF NOT EXISTS performance_history (
  id          TEXT   PRIMARY KEY,
  saved_at    BIGINT NOT NULL,
  date_label  TEXT   NOT NULL,
  range_label TEXT   NOT NULL,
  start_date  TEXT   NOT NULL,
  end_date    TEXT   NOT NULL,
  stats       JSONB  NOT NULL DEFAULT '{}',
  insights    TEXT   NOT NULL
);
