#include "store.hpp"

namespace conveyor {
namespace {

// Postgres builds the JSON for us, so the C++ side never hand-maps columns.
const std::string kJobObj =
    "jsonb_build_object('id', id::text, 'queue', queue, 'type', type, 'payload', payload, "
    "'priority', priority, 'status', status, 'run_at', run_at, 'attempts', attempts, "
    "'max_attempts', max_attempts, 'worker_id', worker_id, 'last_error', last_error, "
    "'created_at', created_at)";
const std::string kJobText = kJobObj + "::text";

// {"a","b"} literal for a text[] parameter (quotes and backslashes escaped).
std::string pg_array(const std::vector<std::string>& v) {
  std::string out = "{";
  for (size_t i = 0; i < v.size(); ++i) {
    if (i) out += ",";
    out += '"';
    for (char c : v[i]) {
      if (c == '"' || c == '\\') out += '\\';
      out += c;
    }
    out += '"';
  }
  return out + "}";
}

}  // namespace

Job Job::from_json(const json& j) {
  Job job;
  job.id = j.at("id").get<std::string>();
  job.queue = j.at("queue").get<std::string>();
  job.type = j.at("type").get<std::string>();
  job.payload = j.at("payload");
  job.priority = j.at("priority").get<int>();
  job.attempts = j.at("attempts").get<int>();
  job.max_attempts = j.at("max_attempts").get<int>();
  return job;
}

// ---------------------------------------------------------------- producer

EnqueueResult Store::enqueue(const NewJob& n) {
  Param key;
  if (!n.idempotency_key.empty()) key = n.idempotency_key;
  Param run_at;
  if (n.run_at) run_at = *n.run_at;

  auto r = pool_.exec(
      "INSERT INTO jobs (queue, type, payload, priority, max_attempts, run_at, idempotency_key) "
      "VALUES ($1, $2, $3::jsonb, $4, $5, COALESCE($6::timestamptz, now()), $7) "
      "ON CONFLICT (idempotency_key) DO NOTHING RETURNING " + kJobText,
      {n.queue, n.type, n.payload.dump(), std::to_string(n.priority),
       std::to_string(n.max_attempts), run_at, key});
  if (r.rows() == 1) return {json::parse(r.str(0, 0)), true};

  // Conflict on idempotency_key: return the job that already exists.
  auto existing = pool_.exec(
      "SELECT " + kJobText + " FROM jobs WHERE idempotency_key = $1", {n.idempotency_key});
  if (existing.rows() == 0) throw DbError("idempotent job vanished", "");
  return {json::parse(existing.str(0, 0)), false};
}

std::optional<json> Store::get(const std::string& id) {
  auto r = pool_.exec("SELECT " + kJobText + " FROM jobs WHERE id = $1", {id});
  if (r.rows() == 0) return std::nullopt;
  return json::parse(r.str(0, 0));
}

// ------------------------------------------------------------------ worker

std::vector<Job> Store::claim(const std::string& worker_id, const std::vector<std::string>& queues,
                              int limit, int lease_secs) {
  // attempts is bumped here; together with worker_id it is the fencing token.
  auto r = pool_.exec(
      "UPDATE jobs SET status='running', worker_id=$1, attempts=attempts+1, "
      "  lease_expires_at = now() + make_interval(secs => $4::double precision) "
      "WHERE id IN ( "
      "  SELECT id FROM jobs "
      "  WHERE status='queued' AND run_at <= now() AND queue = ANY($2::text[]) "
      "  ORDER BY priority DESC, run_at "
      "  LIMIT $3 "
      "  FOR UPDATE SKIP LOCKED) "
      "RETURNING " + kJobText,
      {worker_id, pg_array(queues), std::to_string(limit), std::to_string(lease_secs)});

  std::vector<Job> jobs;
  for (int i = 0; i < r.rows(); ++i) jobs.push_back(Job::from_json(json::parse(r.str(i, 0))));
  return jobs;
}

bool Store::succeed(const Job& j, const std::string& worker_id) {
  auto r = pool_.exec(
      "UPDATE jobs SET status='succeeded', lease_expires_at=NULL, finished_at=now(), "
      "  last_error=NULL "
      "WHERE id=$1 AND worker_id=$2 AND attempts=$3 AND status='running'",
      {j.id, worker_id, std::to_string(j.attempts)});
  return r.affected() == 1;
}

bool Store::fail(const Job& j, const std::string& worker_id, const std::string& error,
                 double retry_delay_secs) {
  auto r = pool_.exec(
      "UPDATE jobs SET "
      "  status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END, "
      "  run_at = now() + make_interval(secs => $4::double precision), "
      "  last_error = $5, worker_id = NULL, lease_expires_at = NULL, "
      "  finished_at = CASE WHEN attempts >= max_attempts THEN now() END "
      "WHERE id=$1 AND worker_id=$2 AND attempts=$3 AND status='running'",
      {j.id, worker_id, std::to_string(j.attempts), std::to_string(retry_delay_secs), error});
  return r.affected() == 1;
}

// -------------------------------------------------------- worker lifecycle

void Store::register_worker(const std::string& id, const std::string& host,
                            const std::vector<std::string>& queues, int concurrency) {
  pool_.exec(
      "INSERT INTO workers (id, hostname, queues, concurrency) VALUES ($1, $2, $3::text[], $4) "
      "ON CONFLICT (id) DO UPDATE SET hostname=$2, queues=$3::text[], concurrency=$4, "
      "  status='active', last_heartbeat=now(), started_at=now()",
      {id, host, pg_array(queues), std::to_string(concurrency)});
}

long Store::heartbeat(const std::string& worker_id, int lease_secs) {
  pool_.exec("UPDATE workers SET last_heartbeat=now(), status='active' WHERE id=$1", {worker_id});
  // Only this worker's own running jobs: it can never extend a job that was re-claimed.
  auto r = pool_.exec(
      "UPDATE jobs SET lease_expires_at = now() + make_interval(secs => $2::double precision) "
      "WHERE worker_id=$1 AND status='running'",
      {worker_id, std::to_string(lease_secs)});
  return r.affected();
}

void Store::deregister(const std::string& worker_id) {
  pool_.exec("UPDATE workers SET status='stopped' WHERE id=$1", {worker_id});
}

// --------------------------------------------------------------- scheduler

long Store::reap() {
  auto r = pool_.exec(
      "UPDATE jobs SET "
      "  status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END, "
      "  worker_id = NULL, lease_expires_at = NULL, "
      "  last_error = 'lease expired: worker presumed dead', "
      "  finished_at = CASE WHEN attempts >= max_attempts THEN now() END "
      "WHERE status='running' AND lease_expires_at < now()");
  return r.affected();
}

long Store::mark_stale_workers(int older_than_secs) {
  auto r = pool_.exec(
      "UPDATE workers SET status='dead' WHERE status='active' "
      "AND last_heartbeat < now() - make_interval(secs => $1::double precision)",
      {std::to_string(older_than_secs)});
  return r.affected();
}

// ------------------------------------------------------ observability / DLQ

json Store::list_workers() {
  auto r = pool_.exec(
      "SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.started_at DESC), '[]'::jsonb)::text "
      "FROM (SELECT id, hostname, queues, concurrency, status, started_at, last_heartbeat "
      "      FROM workers ORDER BY started_at DESC LIMIT 200) w");
  return json::parse(r.str(0, 0));
}

json Store::stats() {
  auto r = pool_.exec("SELECT status, count(*) FROM jobs GROUP BY status");
  json out = {{"blocked", 0}, {"queued", 0}, {"running", 0}, {"succeeded", 0}, {"dead", 0}};
  for (int i = 0; i < r.rows(); ++i) out[r.str(i, 0)] = std::stol(r.str(i, 1));
  return out;
}

json Store::list_dead(int limit) {
  auto r = pool_.exec(
      "SELECT COALESCE(jsonb_agg(d.j ORDER BY d.finished_at DESC), '[]'::jsonb)::text "
      "FROM (SELECT " + kJobObj + " AS j, finished_at FROM jobs WHERE status='dead' "
      "      ORDER BY finished_at DESC LIMIT $1) d",
      {std::to_string(limit)});
  return json::parse(r.str(0, 0));
}

std::pair<ReplayStatus, json> Store::replay(const std::string& id) {
  auto r = pool_.exec(
      "UPDATE jobs SET status='queued', attempts=0, run_at=now(), last_error=NULL, "
      "  finished_at=NULL, worker_id=NULL, lease_expires_at=NULL "
      "WHERE id=$1 AND status='dead' RETURNING " + kJobText,
      {id});
  if (r.rows() == 1) return {ReplayStatus::Ok, json::parse(r.str(0, 0))};

  auto exists = pool_.exec("SELECT 1 FROM jobs WHERE id=$1", {id});
  return {exists.rows() == 0 ? ReplayStatus::NotFound : ReplayStatus::NotDead, json()};
}

}  // namespace conveyor
