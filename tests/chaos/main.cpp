// Chaos test client. Submits N jobs over HTTP, then waits for all of them to finish
// while crash-injected workers (CRASH_PROB > 0) keep dying. PASS = no job lost.
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <map>
#include <set>
#include <string>
#include <thread>

#include "httplib.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using namespace std::chrono_literals;

static std::string env(const char* k, const std::string& d) {
  const char* v = std::getenv(k);
  return (v && *v) ? v : d;
}

int main() {
  const std::string api = env("API_URL", "http://localhost:8080");
  const int n = std::stoi(env("JOBS", "200"));
  const int timeout_s = std::stoi(env("TIMEOUT_SECONDS", "300"));

  httplib::Client cli(api);
  cli.set_connection_timeout(5);
  cli.set_read_timeout(10);

  std::cout << "waiting for API at " << api << " ..." << std::endl;
  bool up = false;
  for (int i = 0; i < 60 && !up; ++i) {
    auto r = cli.Get("/healthz");
    if (r && r->status == 200) up = true; else std::this_thread::sleep_for(1s);
  }
  if (!up) { std::cerr << "API not reachable\n"; return 2; }
  std::this_thread::sleep_for(3s);  // let workers register

  std::vector<std::string> ids;
  for (int i = 0; i < n; ++i) {
    json body = {{"type", "sleep"},
                 {"payload", {{"seconds", 2 + (std::rand() % 5)}}},
                 {"max_attempts", 10}};
    auto r = cli.Post("/jobs", body.dump(), "application/json");
    if (!r || r->status != 201) { std::cerr << "submit failed\n"; return 2; }
    ids.push_back(json::parse(r->body)["id"].get<std::string>());
  }
  std::cout << "submitted " << ids.size() << " jobs" << std::endl;

  std::set<std::string> pending(ids.begin(), ids.end());
  int succeeded = 0, dead = 0, recovered = 0;
  auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(timeout_s);

  while (!pending.empty() && std::chrono::steady_clock::now() < deadline) {
    std::this_thread::sleep_for(2s);
    for (auto it = pending.begin(); it != pending.end();) {
      auto r = cli.Get(("/jobs/" + *it).c_str());
      bool finished = false;
      if (r && r->status == 200) {
        json j = json::parse(r->body, nullptr, false);
        if (!j.is_discarded()) {
          std::string st = j.value("status", "");
          if (st == "succeeded" || st == "dead") {
            finished = true;
            (st == "succeeded" ? succeeded : dead)++;
            if (j.value("attempts", 1) > 1) ++recovered;
          }
        }
      }
      it = finished ? pending.erase(it) : std::next(it);
    }
    std::cout << "  finished " << (ids.size() - pending.size()) << "/" << ids.size() << std::endl;
  }

  int crashed_workers = 0;
  if (auto r = cli.Get("/workers"); r && r->status == 200) {
    json ws = json::parse(r->body, nullptr, false);
    if (ws.is_array()) for (auto& w : ws) if (w.value("status", "") == "dead") ++crashed_workers;
  }

  std::cout << "\n=========== CHAOS RESULT ===========\n"
            << "submitted:                          " << ids.size() << "\n"
            << "succeeded:                          " << succeeded << "\n"
            << "dead (DLQ):                         " << dead << "\n"
            << "still pending (LOST):               " << pending.size() << "\n"
            << "workers that crashed:               " << crashed_workers << "\n"
            << "jobs needing >1 attempt (recovered): " << recovered << "\n";
  if (!pending.empty() || dead > 0) { std::cout << "RESULT: FAIL\n"; return 1; }
  std::cout << "RESULT: PASS - every job completed despite worker crashes\n";
  return 0;
}
