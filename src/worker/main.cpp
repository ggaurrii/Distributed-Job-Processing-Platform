// Worker node: claims jobs, runs handlers, heartbeats, acks/nacks.
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <csignal>
#include <functional>
#include <map>
#include <mutex>
#include <stdexcept>
#include <thread>

#include "store.hpp"
#include "util.hpp"

using namespace conveyor;
using namespace std::chrono_literals;

static std::atomic<bool> g_stop{false};
static void on_signal(int) { g_stop = true; }

// ---------------------------------------------------------------- handlers
// A handler throws on failure. Register new job types in this map.
using JobFn = std::function<void(const json&)>;

static std::map<std::string, JobFn> make_handlers() {
  return {
      {"echo", [](const json& p) { log_info("echo", p.dump()); }},
      {"sleep", [](const json& p) {
         double secs = p.value("seconds", 1.0);
         std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<long>(secs * 1000)));
       }},
      {"flaky", [](const json&) {  // fails ~70% of the time: exercises retries + DLQ
         if (rand_unit() < 0.7) throw std::runtime_error("simulated failure");
       }},
  };
}

// backoff = min(1h, 2s * 2^attempt) with "equal jitter" to avoid retry stampedes.
static double backoff_secs(int attempt) {
  double d = std::min(3600.0, 2.0 * std::pow(2.0, std::min(attempt, 20)));
  return d / 2 + rand_unit() * (d / 2);
}

// ------------------------------------------------------------ shared state
static std::mutex g_mu;
static std::condition_variable g_cv;
static int g_busy = 0;

static void run_job(Store& store, const std::map<std::string, JobFn>& handlers,
                    const std::string& worker_id, const Job& job, double crash_prob) {
  const std::string tag = "job=" + job.id + " type=" + job.type + " attempt=" + std::to_string(job.attempts);

  // Chaos hook: simulate `kill -9`. _exit skips destructors, graceful shutdown and
  // deregistration, exactly like a SIGKILL. The lease expires and the reaper recovers the job.
  if (crash_prob > 0 && rand_unit() < crash_prob) {
    log_warn("CHAOS: crashing this worker now", tag);
    std::this_thread::sleep_for(std::chrono::milliseconds(300 + static_cast<int>(rand_unit() * 900)));
    _exit(137);
  }

  std::string error;
  try {
    auto it = handlers.find(job.type);
    if (it == handlers.end()) throw std::runtime_error("no handler registered for type '" + job.type + "'");
    it->second(job.payload);
  } catch (const std::exception& e) {
    error = e.what();
  } catch (...) {
    error = "unknown exception";
  }

  try {
    if (error.empty()) {
      if (store.succeed(job, worker_id)) log_info("job succeeded", tag);
      else log_warn("ack rejected: lease was lost", tag);
    } else {
      double delay = backoff_secs(job.attempts);
      if (store.fail(job, worker_id, error, delay)) {
        log_warn("job failed", tag + " err=\"" + error + "\" retry_in=" + std::to_string(delay) + "s");
      } else {
        log_warn("nack rejected: lease was lost", tag);
      }
    }
  } catch (const std::exception& e) {
    log_error("could not report job result", tag + " err=" + e.what());
  }
}

int main() {
  std::signal(SIGINT, on_signal);
  std::signal(SIGTERM, on_signal);

  const int concurrency = std::max(1, env_int("CONCURRENCY", 4));
  const int lease = std::max(3, env_int("LEASE_SECONDS", 30));
  const double crash_prob = env_double("CRASH_PROB", 0.0);
  const std::vector<std::string> queues = split(env("QUEUES", "default"), ',');

  char host_buf[256] = "unknown";
  gethostname(host_buf, sizeof host_buf - 1);
  const std::string host = host_buf;
  // Random suffix: a restarted container keeps its hostname and PID, but must NOT inherit the
  // identity of its crashed predecessor (it would keep extending leases on orphaned jobs).
  const std::string worker_id = host + "-" + std::to_string(getpid()) + "-" + random_hex(8);

  Pool pool(env("DATABASE_URL", "postgresql://conveyor:conveyor@localhost:5432/conveyor"), concurrency + 4);
  Store store(pool);
  const auto handlers = make_handlers();

  store.register_worker(worker_id, host, queues, concurrency);
  log_info("worker started", "id=" + worker_id + " concurrency=" + std::to_string(concurrency) +
                                 " lease=" + std::to_string(lease) + "s crash_prob=" + std::to_string(crash_prob));

  // Heartbeat thread: proves liveness and extends leases every lease/3.
  std::mutex hb_mu;
  std::condition_variable hb_cv;
  bool hb_stop = false;
  std::thread heartbeat([&] {
    std::unique_lock<std::mutex> lk(hb_mu);
    while (!hb_stop) {
      hb_cv.wait_for(lk, std::chrono::milliseconds(lease * 1000 / 3), [&] { return hb_stop; });
      if (hb_stop) break;
      lk.unlock();
      try {
        store.heartbeat(worker_id, lease);
      } catch (const std::exception& e) {
        log_warn("heartbeat failed", e.what());
      }
      lk.lock();
    }
  });

  // Main loop: every 500ms claim as many jobs as we have free slots.
  auto next_poll = std::chrono::steady_clock::now();
  while (!g_stop) {
    std::this_thread::sleep_for(100ms);  // short steps so SIGTERM is noticed quickly
    if (std::chrono::steady_clock::now() < next_poll) continue;
    next_poll = std::chrono::steady_clock::now() + 500ms;

    int free_slots;
    { std::lock_guard<std::mutex> lk(g_mu); free_slots = concurrency - g_busy; }
    if (free_slots <= 0) continue;

    std::vector<Job> jobs;
    try {
      jobs = store.claim(worker_id, queues, free_slots, lease);
    } catch (const std::exception& e) {
      log_error("claim failed", e.what());
      continue;
    }
    for (const Job& job : jobs) {
      { std::lock_guard<std::mutex> lk(g_mu); ++g_busy; }
      std::thread([&, job] {
        run_job(store, handlers, worker_id, job, crash_prob);
        std::lock_guard<std::mutex> lk(g_mu);  // notify while locked: main can't exit under us
        --g_busy;
        g_cv.notify_all();
      }).detach();
    }
  }

  log_info("shutting down, waiting for in-flight jobs");
  {
    std::unique_lock<std::mutex> lk(g_mu);
    g_cv.wait(lk, [] { return g_busy == 0; });
  }
  { std::lock_guard<std::mutex> lk(hb_mu); hb_stop = true; }
  hb_cv.notify_all();
  heartbeat.join();
  try { store.deregister(worker_id); } catch (const std::exception& e) { log_warn("deregister failed", e.what()); }
  log_info("worker stopped");
  return 0;
}
