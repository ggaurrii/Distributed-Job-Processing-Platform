#pragma once
#include <chrono>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <vector>

namespace conveyor {

inline std::string env(const char* key, const std::string& def) {
  const char* v = std::getenv(key);
  return (v && *v) ? std::string(v) : def;
}

inline int env_int(const char* key, int def) {
  try { return std::stoi(env(key, std::to_string(def))); } catch (...) { return def; }
}

inline double env_double(const char* key, double def) {
  try { return std::stod(env(key, std::to_string(def))); } catch (...) { return def; }
}

inline std::vector<std::string> split(const std::string& s, char sep) {
  std::vector<std::string> out;
  std::string cur;
  std::stringstream ss(s);
  while (std::getline(ss, cur, sep)) {
    if (!cur.empty()) out.push_back(cur);
  }
  return out;
}

// Uniform random double in [0,1). One generator per thread, so no locking needed.
inline double rand_unit() {
  thread_local std::mt19937_64 gen{std::random_device{}()};
  return std::uniform_real_distribution<double>(0.0, 1.0)(gen);
}

inline std::string random_hex(int digits) {
  static const char* kHex = "0123456789abcdef";
  std::string s;
  for (int i = 0; i < digits; ++i) s += kHex[static_cast<int>(rand_unit() * 16) % 16];
  return s;
}

inline void log_line(const char* level, const std::string& msg, const std::string& fields) {
  static std::mutex m;
  std::time_t t = std::time(nullptr);
  std::tm tm{};
  gmtime_r(&t, &tm);
  char buf[32];
  std::strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%SZ", &tm);
  std::lock_guard<std::mutex> lk(m);
  std::cout << buf << " " << level << " " << msg;
  if (!fields.empty()) std::cout << " " << fields;
  std::cout << std::endl;  // flush every line so `docker compose logs` is live
}

inline void log_info(const std::string& msg, const std::string& f = "")  { log_line("INFO ", msg, f); }
inline void log_warn(const std::string& msg, const std::string& f = "")  { log_line("WARN ", msg, f); }
inline void log_error(const std::string& msg, const std::string& f = "") { log_line("ERROR", msg, f); }

}  // namespace conveyor
