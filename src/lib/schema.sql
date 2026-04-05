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
  status      TEXT    NOT NULL DEFAULT 'todo'   CHECK (status   IN ('todo', 'in-progress', 'in-review', 'done')),
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
  country     TEXT,
  region      TEXT,
  city        TEXT,
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

-- ── Professional Growth ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_topics (
  id          TEXT    PRIMARY KEY,
  label       TEXT    NOT NULL,
  description TEXT,
  is_custom   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_materials (
  id           TEXT   PRIMARY KEY,
  topic_id     TEXT   NOT NULL REFERENCES growth_topics(id) ON DELETE CASCADE,
  title        TEXT   NOT NULL,
  type         TEXT   NOT NULL CHECK (type IN ('file', 'link', 'note', 'ai_suggestion')),
  url          TEXT,
  file_name    TEXT,
  file_size    BIGINT,
  mime_type    TEXT,
  content_text TEXT,
  source_url   TEXT,
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_materials_topic ON growth_materials (topic_id);

CREATE TABLE IF NOT EXISTS growth_quizzes (
  id           TEXT   PRIMARY KEY,
  topic_id     TEXT   NOT NULL REFERENCES growth_topics(id) ON DELETE CASCADE,
  date_key     TEXT   NOT NULL,
  questions    JSONB  NOT NULL DEFAULT '[]',
  lesson       JSONB  NOT NULL DEFAULT '{}',
  generated_at BIGINT NOT NULL,
  UNIQUE (topic_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_growth_quizzes_date ON growth_quizzes (date_key);

CREATE TABLE IF NOT EXISTS growth_quiz_attempts (
  id           TEXT    PRIMARY KEY,
  quiz_id      TEXT    NOT NULL REFERENCES growth_quizzes(id) ON DELETE CASCADE,
  topic_id     TEXT    NOT NULL,
  date_key     TEXT    NOT NULL,
  answers      JSONB   NOT NULL DEFAULT '[]',
  score        NUMERIC NOT NULL,
  total_q      INT     NOT NULL,
  correct_q    INT     NOT NULL,
  completed_at BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_attempts_topic ON growth_quiz_attempts (topic_id);
CREATE INDEX IF NOT EXISTS idx_growth_attempts_date  ON growth_quiz_attempts (date_key);
CREATE INDEX IF NOT EXISTS idx_growth_attempts_quiz  ON growth_quiz_attempts (quiz_id);

CREATE TABLE IF NOT EXISTS growth_insights (
  id           TEXT    PRIMARY KEY,
  topic_id     TEXT    NOT NULL REFERENCES growth_topics(id) ON DELETE CASCADE,
  generated_at BIGINT  NOT NULL,
  avg_score    NUMERIC,
  trend        TEXT    CHECK (trend IN ('improving', 'declining', 'stable', 'insufficient_data')),
  takeaways    JSONB   NOT NULL DEFAULT '[]',
  improvements JSONB   NOT NULL DEFAULT '[]',
  weaknesses   JSONB   NOT NULL DEFAULT '[]',
  summary_text TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_insights_topic ON growth_insights (topic_id);

CREATE TABLE IF NOT EXISTS growth_modules (
  id           TEXT   PRIMARY KEY,
  topic_id     TEXT   NOT NULL REFERENCES growth_topics(id) ON DELETE CASCADE,
  title        TEXT   NOT NULL,
  modules      JSONB  NOT NULL DEFAULT '{}',
  generated_at BIGINT NOT NULL,
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_modules_topic ON growth_modules (topic_id);

-- ── Projects ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT   PRIMARY KEY,
  name        TEXT   NOT NULL,
  description TEXT,
  color       TEXT   NOT NULL DEFAULT '#6366f1',
  created_at  BIGINT NOT NULL
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);

CREATE TABLE IF NOT EXISTS time_logs (
  id            TEXT   PRIMARY KEY,
  project_id    TEXT   NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id       TEXT   REFERENCES tasks(id) ON DELETE SET NULL,
  description   TEXT   NOT NULL,
  duration_min  INT    NOT NULL,
  logged_date   TEXT   NOT NULL,
  created_at    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_time_logs_project ON time_logs (project_id);

CREATE TABLE IF NOT EXISTS project_meetings (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id  TEXT NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  linked_at   BIGINT NOT NULL,
  PRIMARY KEY (project_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_project_meetings_project ON project_meetings (project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_meeting ON project_meetings (meeting_id);

INSERT INTO growth_topics (id, label, description, is_custom, created_at) VALUES
  ('data-engineering',        'Data Engineering',         'Pipelines, ETL/ELT, data lakes, warehouse design', FALSE, 0),
  ('devops',                  'DevOps',                   'CI/CD, infrastructure as code, monitoring, SRE', FALSE, 0),
  ('ml',                      'Machine Learning',         'Model training, evaluation, classical ML algorithms', FALSE, 0),
  ('mlops',                   'MLOps',                    'ML pipelines, model versioning, deployment, drift monitoring', FALSE, 0),
  ('kubernetes',              'Kubernetes',               'Container orchestration, Helm, service mesh, K8s internals', FALSE, 0),
  ('sql',                     'SQL',                      'Query optimisation, window functions, indexing, modelling', FALSE, 0),
  ('spark',                   'Apache Spark',             'Distributed processing, DataFrames, optimisation, Spark SQL', FALSE, 0),
  ('python-dsa',              'Python (DSA)',              'Data structures, algorithms, complexity, LeetCode patterns', FALSE, 0),
  ('aws-solutions-architect', 'AWS Solutions Architect',  'AWS services, well-architected framework, cost optimisation', FALSE, 0),
  ('power-bi',                'Power BI',                 'DAX, data modelling, reports, gateway, row-level security', FALSE, 0),
  ('dashboard-engineering',   'Dashboard Engineering',    'BI design principles, UX for data, Looker, Grafana', FALSE, 0),
  ('business-consultancy',    'Business Consultancy',     'Stakeholder management, requirements gathering, strategy', FALSE, 0),
  ('problem-solving',         'Problem Solving',          'Structured thinking, root cause analysis, frameworks', FALSE, 0),
  ('active-listening',        'Active Listening',         'Communication, note-taking, empathy, feedback loops', FALSE, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Daily Assessments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_assessments (
  id            TEXT   PRIMARY KEY,
  date_key      TEXT   NOT NULL,
  scenario      TEXT   NOT NULL,
  topics_covered JSONB NOT NULL DEFAULT '[]',
  context_data  JSONB  NOT NULL DEFAULT '{}',
  generated_at  BIGINT NOT NULL,
  UNIQUE (date_key)
);

CREATE TABLE IF NOT EXISTS growth_assessment_submissions (
  id            TEXT    PRIMARY KEY,
  assessment_id TEXT    NOT NULL REFERENCES growth_assessments(id) ON DELETE CASCADE,
  date_key      TEXT    NOT NULL,
  answer        TEXT    NOT NULL,
  score         NUMERIC NOT NULL,
  feedback      JSONB   NOT NULL DEFAULT '{}',
  submitted_at  BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_date ON growth_assessments (date_key);
CREATE INDEX IF NOT EXISTS idx_assessment_sub_date ON growth_assessment_submissions (date_key);

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
