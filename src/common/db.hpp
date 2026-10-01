#pragma once
// Tiny libpq wrapper: a connection pool plus a parameterised-query helper.
// All SQL uses $1,$2,... placeholders, so user input is never spliced into SQL.
#include <libpq-fe.h>

#include <condition_variable>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace conveyor {

using Param = std::optional<std::string>;  // std::nullopt = SQL NULL

struct DbError : std::runtime_error {
  std::string sqlstate;  // e.g. "22P02" = malformed UUID
  DbError(const std::string& msg, std::string state)
      : std::runtime_error(msg), sqlstate(std::move(state)) {}
};

// Owns a PGresult* and frees it automatically.
class Result {
 public:
  explicit Result(PGresult* r) : r_(r) {}
  ~Result() { if (r_) PQclear(r_); }
  Result(Result&& o) noexcept : r_(o.r_) { o.r_ = nullptr; }
  Result(const Result&) = delete;
  Result& operator=(const Result&) = delete;

  int rows() const { return PQntuples(r_); }
  std::string str(int row, int col) const { return PQgetvalue(r_, row, col); }
  bool is_null(int row, int col) const { return PQgetisnull(r_, row, col) != 0; }
  long affected() const {
    const char* s = PQcmdTuples(r_);
    return (s && *s) ? std::atol(s) : 0;
  }

 private:
  PGresult* r_;
};

class Pool {
 public:
  Pool(std::string conninfo, int size);
  ~Pool();
  Pool(const Pool&) = delete;
  Pool& operator=(const Pool&) = delete;

  // Borrows a connection, runs one statement, returns the connection.
  // Throws DbError on failure.
  Result exec(const std::string& sql, const std::vector<Param>& params = {});

 private:
  PGconn* acquire();
  void release(PGconn* c);

  std::string conninfo_;
  std::mutex m_;
  std::condition_variable cv_;
  std::vector<PGconn*> idle_;
  std::vector<PGconn*> all_;
};

}  // namespace conveyor
