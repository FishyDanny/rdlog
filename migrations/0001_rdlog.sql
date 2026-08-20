CREATE TABLE IF NOT EXISTS rdlog_workspaces (
  id TEXT PRIMARY KEY,
  owner_email TEXT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rdlog_experiments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES rdlog_workspaces(id)
);

CREATE TABLE IF NOT EXISTS rdlog_entries (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hypothesis', 'method', 'observation', 'evaluation', 'conclusion', 'note')),
  body TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  hash TEXT NOT NULL CHECK (length(hash) = 64),
  previous_hash TEXT CHECK (previous_hash IS NULL OR length(previous_hash) = 64),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  FOREIGN KEY (experiment_id) REFERENCES rdlog_experiments(id),
  UNIQUE (experiment_id, sequence)
);

CREATE TABLE IF NOT EXISTS rdlog_amendments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  hash TEXT NOT NULL CHECK (length(hash) = 64),
  FOREIGN KEY (entry_id) REFERENCES rdlog_entries(id)
);

CREATE TABLE IF NOT EXISTS rdlog_anchors (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  calendar_url TEXT NOT NULL,
  receipt TEXT NOT NULL,
  anchored_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  FOREIGN KEY (entry_id) REFERENCES rdlog_entries(id),
  UNIQUE (entry_id, calendar_url)
);

CREATE INDEX IF NOT EXISTS rdlog_experiments_workspace_opened
  ON rdlog_experiments(workspace_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS rdlog_entries_experiment_sequence
  ON rdlog_entries(experiment_id, sequence);

CREATE INDEX IF NOT EXISTS rdlog_amendments_entry_created
  ON rdlog_amendments(entry_id, created_at);

CREATE INDEX IF NOT EXISTS rdlog_anchors_entry_calendar
  ON rdlog_anchors(entry_id, calendar_url);

INSERT OR IGNORE INTO _migrations (name, applied_at)
VALUES ('0001_rdlog.sql', datetime('now'));
