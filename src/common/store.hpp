#pragma once
// Store = every queue rule (claim, ack, retry, DLQ, recovery) in one place.
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "db.hpp"

namespace conveyor {

using json = nlohmann::json;

struct Job {
  std::string id, queue, type;
  json payload;
  int priority = 0, attempts = 0, max_attempts = 5;
  static Job from_json(const json& j);
};

struct NewJob {
  std::string queue = "default";
  std::string type;
  json payload = json::object();
  int priority = 0;
  int max_attempts = 5;
  std::optional<std::string> run_at;  // ISO-8601 timestamp; nullopt = now
  std::string idempotency_key;        // empty = none
};

struct EnqueueResult {
  json job;
  bool created;
};

enum class ReplayStatus { Ok, NotFound, NotDead };

class Store {
 public:
  explicit Store(Pool& pool) : pool_(pool) {}

  // ---- producer side ----
  EnqueueResult enqueue(const NewJob& n);
  std::optional<json> get(const std::string& id);

  // ---- worker side ----
  // Atomically hands up to `limit` runnable jobs to a worker (FOR UPDATE SKIP LOCKED).
  std::vector<Job> claim(const std::string& worker_id, const std::vector<std::string>& queues,
                         int limit, int lease_secs);
  // Both return false if the lease was lost (fencing: another attempt owns the job now).
  bool succeed(const Job& j, const std::string& worker_id);
  bool fail(const Job& j, const std::string& worker_id, const std::string& error,
            double retry_delay_secs);

  // ---- worker lifecycle ----
  void register_worker(const std::string& id, const std::string& host,
                       const std::vector<std::string>& queues, int concurrency);
  long heartbeat(const std::string& worker_id, int lease_secs);  // returns leases extended
  void deregister(const std::string& worker_id);

  // ---- scheduler side ----
  long reap();                               // expired leases -> queued (or dead)
  long mark_stale_workers(int older_than_secs);

  // ---- observability / DLQ ----
  json list_workers();
  json stats();
  json list_dead(int limit);
  std::pair<ReplayStatus, json> replay(const std::string& id);

 private:
  Pool& pool_;
};

}  // namespace conveyor
