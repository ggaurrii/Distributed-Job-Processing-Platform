#include "db.hpp"

#include <chrono>
#include <thread>

#include "util.hpp"

namespace conveyor {

static std::string trim(std::string s) {
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) s.pop_back();
  return s;
}

static PGconn* connect_or_throw(const std::string& conninfo) {
  PGconn* c = PQconnectdb(conninfo.c_str());
  if (PQstatus(c) != CONNECTION_OK) {
    std::string msg = trim(PQerrorMessage(c));
    PQfinish(c);
    throw DbError("connect failed: " + msg, "");
  }
  return c;
}

Pool::Pool(std::string conninfo, int size) : conninfo_(std::move(conninfo)) {
  // The database container may still be starting: retry the first connection.
  PGconn* first = nullptr;
  for (int attempt = 0; attempt < 30 && !first; ++attempt) {
    try {
      first = connect_or_throw(conninfo_);
    } catch (const DbError& e) {
      log_warn("waiting for database", e.what());
      std::this_thread::sleep_for(std::chrono::seconds(1));
    }
  }
  if (!first) throw DbError("could not connect to database", "");
  all_.push_back(first);
  try {
    for (int i = 1; i < size; ++i) all_.push_back(connect_or_throw(conninfo_));
  } catch (...) {
    for (PGconn* c : all_) PQfinish(c);
    throw;
  }
  idle_ = all_;
}

Pool::~Pool() {
  for (PGconn* c : all_) PQfinish(c);
}

PGconn* Pool::acquire() {
  std::unique_lock<std::mutex> lk(m_);
  cv_.wait(lk, [&] { return !idle_.empty(); });
  PGconn* c = idle_.back();
  idle_.pop_back();
  return c;
}

void Pool::release(PGconn* c) {
  {
    std::lock_guard<std::mutex> lk(m_);
    idle_.push_back(c);
  }
  cv_.notify_one();
}

Result Pool::exec(const std::string& sql, const std::vector<Param>& params) {
  PGconn* conn = acquire();
  struct Guard {
    Pool* p;
    PGconn* c;
    ~Guard() { p->release(c); }
  } guard{this, conn};

  if (PQstatus(conn) != CONNECTION_OK) PQreset(conn);  // recover from dropped connections

  std::vector<const char*> values;
  values.reserve(params.size());
  for (const auto& p : params) values.push_back(p ? p->c_str() : nullptr);

  PGresult* res = PQexecParams(conn, sql.c_str(), static_cast<int>(values.size()), nullptr,
                               values.data(), nullptr, nullptr, 0);
  ExecStatusType st = PQresultStatus(res);
  if (st != PGRES_COMMAND_OK && st != PGRES_TUPLES_OK) {
    std::string msg = trim(PQresultErrorMessage(res));
    const char* ss = PQresultErrorField(res, PG_DIAG_SQLSTATE);
    std::string state = ss ? ss : "";
    PQclear(res);
    throw DbError(msg.empty() ? trim(PQerrorMessage(conn)) : msg, state);
  }
  return Result(res);
}

}  // namespace conveyor
