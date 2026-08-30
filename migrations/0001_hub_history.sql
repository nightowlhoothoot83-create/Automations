CREATE TABLE IF NOT EXISTS decisions (
  approval_id TEXT PRIMARY KEY,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes-requested', 'deferred')),
  actor TEXT NOT NULL DEFAULT 'owner',
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  approval_id TEXT,
  decision TEXT,
  actor TEXT,
  recorded_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_history_recorded_at ON history_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_approval_id ON history_events(approval_id);

CREATE TABLE IF NOT EXISTS history_archive (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  approval_id TEXT,
  decision TEXT,
  actor TEXT,
  recorded_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  archived_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_archive_recorded_at ON history_archive(recorded_at DESC);
