# ---- build stage: compiles all 4 binaries ----
FROM ubuntu:24.04 AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake libpq-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Header-only libraries: HTTP server + JSON
ADD https://raw.githubusercontent.com/yhirose/cpp-httplib/v0.18.3/httplib.h /usr/local/include/httplib.h
ADD https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp /usr/local/include/nlohmann/json.hpp
WORKDIR /src
COPY CMakeLists.txt .
COPY src src
COPY tests tests
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j2

# ---- runtime stage: small image with just the binaries ----
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/conveyor-api \
                  /src/build/conveyor-worker \
                  /src/build/conveyor-scheduler \
                  /src/build/conveyor-chaos /usr/local/bin/
