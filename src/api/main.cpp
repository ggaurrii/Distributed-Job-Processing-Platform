// REST API: submit jobs, inspect jobs, DLQ, stats, workers.
#include <atomic>
#include <chrono>
#include <csignal>
#include <functional>
#include <thread>

#include "httplib.h"
#include "store.hpp"
#include "util.hpp"

using namespace conveyor;

static std::atomic<bool> g_stop{false};
static void on_signal(int) { g_stop = true; }

using Handler = std::function<void(const httplib::Request&, httplib::Response&)>;

static void reply(httplib::Response& res, int code, const json& body) {
  res.status = code;
  res.set_content(body.dump(), "application/json");
}

// Wraps a handler so any exception becomes a clean JSON error instead of a crash.
static Handler guarded(Handler h) {
  return [h](const httplib::Request& req, httplib::Response& res) {
    try {
      h(req, res);
    } catch (const DbError& e) {
      if (e.sqlstate == "22P02") {  // invalid_text_representation, e.g. malformed UUID
        reply(res, 400, {{"error", "bad request"}});
      } else {
        log_error("database error", e.what());
        reply(res, 500, {{"error", "internal error"}});
      }
    } catch (const std::exception& e) {
      log_error("unhandled error", e.what());
      reply(res, 500, {{"error", "internal error"}});
    }
  };
}

int main() {
  std::signal(SIGINT, on_signal);
  std::signal(SIGTERM, on_signal);

  Pool pool(env("DATABASE_URL", "postgresql://conveyor:conveyor@localhost:5432/conveyor"), 16);
  Store store(pool);

  httplib::Server svr;
  svr.new_task_queue = [] { return new httplib::ThreadPool(16); };

  svr.Get("/healthz", [](const httplib::Request&, httplib::Response& res) {
    res.set_content("ok", "text/plain");
  });

  svr.Post("/jobs", guarded([&](const httplib::Request& req, httplib::Response& res) {
    json body = json::parse(req.body, nullptr, false);
    if (body.is_discarded() || !body.is_object()) {
      reply(res, 400, {{"error", "invalid JSON body"}});
      return;
    }
    NewJob n;
    try {
      n.type = body.value("type", "");
      n.queue = body.value("queue", "default");
      n.priority = body.value("priority", 0);
      n.max_attempts = body.value("max_attempts", 5);
      n.idempotency_key = body.value("idempotency_key", "");
      if (body.contains("payload")) n.payload = body["payload"];
      if (body.contains("run_at") && body["run_at"].is_string()) n.run_at = body["run_at"].get<std::string>();
    } catch (const json::exception&) {
      reply(res, 400, {{"error", "invalid field type"}});
      return;
    }
    if (n.type.empty()) {
      reply(res, 400, {{"error", "type is required"}});
      return;
    }
    if (n.queue.empty()) n.queue = "default";
    if (n.max_attempts <= 0) n.max_attempts = 5;
    std::string hdr = req.get_header_value("Idempotency-Key");
    if (!hdr.empty()) n.idempotency_key = hdr;

    EnqueueResult r = store.enqueue(n);
    reply(res, r.created ? 201 : 200, r.job);  // 200 = idempotent replay
  }));

  svr.Get(R"(/jobs/([^/]+))", guarded([&](const httplib::Request& req, httplib::Response& res) {
    auto job = store.get(req.matches[1].str());
    if (!job) { reply(res, 404, {{"error", "not found"}}); return; }
    reply(res, 200, *job);
  }));

  svr.Post(R"(/jobs/([^/]+)/replay)", guarded([&](const httplib::Request& req, httplib::Response& res) {
    auto [status, job] = store.replay(req.matches[1].str());
    switch (status) {
      case ReplayStatus::Ok:       reply(res, 200, job); break;
      case ReplayStatus::NotFound: reply(res, 404, {{"error", "not found"}}); break;
      case ReplayStatus::NotDead:  reply(res, 409, {{"error", "job is not dead"}}); break;
    }
  }));

  svr.Get("/stats", guarded([&](const httplib::Request&, httplib::Response& res) {
    reply(res, 200, store.stats());
  }));
  svr.Get("/workers", guarded([&](const httplib::Request&, httplib::Response& res) {
    reply(res, 200, store.list_workers());
  }));
  svr.Get("/dead", guarded([&](const httplib::Request&, httplib::Response& res) {
    reply(res, 200, store.list_dead(100));
  }));

  std::thread watcher([&] {
    while (!g_stop) std::this_thread::sleep_for(std::chrono::milliseconds(100));
    svr.stop();
  });

  int port = env_int("PORT", 8080);
  log_info("api listening", "port=" + std::to_string(port));
  if (!svr.listen("0.0.0.0", port)) log_error("listen failed", "port=" + std::to_string(port));
  g_stop = true;
  watcher.join();
  log_info("api stopped");
  return 0;
}
