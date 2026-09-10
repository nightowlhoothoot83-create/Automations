CREATE TABLE IF NOT EXISTS release_evidence (
  release_sha TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('check', 'test', 'preview', 'deploy')),
  status TEXT NOT NULL CHECK (status IN ('requested', 'running', 'success', 'failed', 'cancelled')),
  run_id TEXT,
  run_url TEXT,
  preview_url TEXT,
  screenshot_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (release_sha, stage)
);

CREATE INDEX IF NOT EXISTS idx_release_evidence_recorded_at
  ON release_evidence(recorded_at DESC);
