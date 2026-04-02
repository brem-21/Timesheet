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

-- ── Kafka-backed event stream ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_events (
  id          TEXT   PRIMARY KEY,
  type        TEXT   NOT NULL,   -- 'page_view' | 'click' | 'feature_use' | 'api_call'
  session_id  TEXT   NOT NULL,
  path        TEXT,
  component   TEXT,
  action      TEXT,
  os          TEXT,
  browser     TEXT,
  device_type TEXT,
  ip          TEXT,
  referrer    TEXT,
  timestamp   BIGINT NOT NULL,
  metadata    JSONB  NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_user_events_timestamp   ON user_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_session     ON user_events (session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_path        ON user_events (path);
CREATE INDEX IF NOT EXISTS idx_user_events_type        ON user_events (type);

CREATE TABLE IF NOT EXISTS recommendations (
  feature      TEXT   PRIMARY KEY,
  label        TEXT   NOT NULL,
  description  TEXT   NOT NULL,
  score        NUMERIC NOT NULL DEFAULT 0,  -- 0 = heavily used, 1 = never used
  last_updated BIGINT NOT NULL
);

-- ── Performance history ────────────────────────────────────────────────────────

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
