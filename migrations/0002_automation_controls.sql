CREATE TABLE IF NOT EXISTS automation_schedules (
  automation_id TEXT PRIMARY KEY,
  frequency TEXT NOT NULL CHECK (frequency IN ('6h', 'daily', 'weekly', 'manual')),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  managed_by_hub INTEGER NOT NULL DEFAULT 0 CHECK (managed_by_hub IN (0, 1)),
  last_run_at TEXT,
  next_run_at TEXT,
  last_status TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_actions (
  action_id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_automation_schedules_next_run
  ON automation_schedules(paused, managed_by_hub, next_run_at);

CREATE INDEX IF NOT EXISTS idx_automation_actions_recorded_at
  ON automation_actions(recorded_at DESC);
