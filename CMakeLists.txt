cmake_minimum_required(VERSION 3.16)
project(conveyor CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
add_compile_options(-Wall -Wextra)

find_package(PostgreSQL REQUIRED)
find_package(Threads REQUIRED)

# Shared code: PostgreSQL pool + all queue logic
add_library(common STATIC src/common/db.cpp src/common/store.cpp)
target_include_directories(common PUBLIC src/common)
target_link_libraries(common PUBLIC PostgreSQL::PostgreSQL Threads::Threads)

add_executable(conveyor-api       src/api/main.cpp)
add_executable(conveyor-worker    src/worker/main.cpp)
add_executable(conveyor-scheduler src/scheduler/main.cpp)
target_link_libraries(conveyor-api       PRIVATE common)
target_link_libraries(conveyor-worker    PRIVATE common)
target_link_libraries(conveyor-scheduler PRIVATE common)

# Chaos test client (talks to the API over HTTP only)
add_executable(conveyor-chaos tests/chaos/main.cpp)
target_link_libraries(conveyor-chaos PRIVATE Threads::Threads)
