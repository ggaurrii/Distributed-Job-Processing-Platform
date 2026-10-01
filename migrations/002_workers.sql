CREATE TABLE workers (
  id             TEXT PRIMARY KEY,
  hostname       TEXT        NOT NULL,
  queues         TEXT[]      NOT NULL,
  concurrency    INT         NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'active',   -- active | stopped | dead
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The reaper scans running jobs by lease expiry; keep that cheap.
CREATE INDEX idx_jobs_lease ON jobs (lease_expires_at) WHERE status = 'running';
