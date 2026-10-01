CREATE TABLE jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue            TEXT        NOT NULL DEFAULT 'default',
  type             TEXT        NOT NULL,
  payload          JSONB       NOT NULL DEFAULT '{}',
  priority         INT         NOT NULL DEFAULT 0,          -- higher runs first
  status           TEXT        NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('blocked','queued','running','succeeded','dead')),
  run_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts         INT         NOT NULL DEFAULT 0,
  max_attempts     INT         NOT NULL DEFAULT 5,
  worker_id        TEXT,
  lease_expires_at TIMESTAMPTZ,
  idempotency_key  TEXT UNIQUE,                              -- NULLs allowed, many
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);

-- Partial index: only queued rows, ordered exactly how workers claim them.
CREATE INDEX idx_jobs_claim ON jobs (queue, priority DESC, run_at) WHERE status = 'queued';
