// Background maintenance. Phase 2: the reaper (failure recovery).
// Phase 3 will add leader election, delayed/cron promotion, dependency resolution.
#include <atomic>
#include <chrono>
#include <csignal>
#include <thread>

#include "store.hpp"
#include "util.hpp"

using namespace conveyor;

static std::atomic<bool> g_stop{false};
static void on_signal(int) { g_stop = true; }

int main() {
  std::signal(SIGINT, on_signal);
  std::signal(SIGTERM, on_signal);

  Pool pool(env("DATABASE_URL", "postgresql://conveyor:conveyor@localhost:5432/conveyor"), 2);
  Store store(pool);

  int lease = env_int("LEASE_SECONDS", 30);
  if (lease <= 0) lease = 30;
  log_info("scheduler started", "worker_stale_after=" + std::to_string(lease) + "s");

  while (!g_stop) {
    // Sleep 2s total, in small steps so SIGTERM is handled quickly.
    for (int i = 0; i < 20 && !g_stop; ++i) std::this_thread::sleep_for(std::chrono::milliseconds(100));
    if (g_stop) break;

    try {
      long n = store.reap();
      if (n > 0) log_warn("reaped jobs from dead workers", "count=" + std::to_string(n));
      long w = store.mark_stale_workers(lease);
      if (w > 0) log_warn("workers marked dead", "count=" + std::to_string(w));
    } catch (const std::exception& e) {
      log_error("maintenance failed", e.what());
    }
  }
  log_info("scheduler stopped");
  return 0;
}
