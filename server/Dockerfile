# ===================== 1. Build Stage =====================
FROM oven/bun:1.1 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
  curl \
  python3 \
  python3-pip \
  build-essential \
  linux-headers-amd64 \
  && ln -s /usr/bin/python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ./worker/prebuild

# Download prebuilt MediaSoup worker (adjust kernel version to match the binary)
RUN curl -L -o ./worker/prebuild/mediasoup-worker-3.15.8-linux-x64-kernel6.tgz \
  https://github.com/versatica/mediasoup/releases/download/3.15.8/mediasoup-worker-3.15.8-linux-x64-kernel6.tgz

# Copy only package files for caching bun install
COPY package.json ./

# Set env to force prebuilt download, and PYTHONPATH for invoke python module
ENV MEDIASOUP_FORCE_WORKER_PREBUILT_DOWNLOAD=true
ENV PYTHONPATH=/app/node_modules/mediasoup/worker/pip_invoke

RUN bun install

COPY . .

# ===================== 2. Runtime Stage =====================
FROM oven/bun:1.1-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

ENV NODE_ENV=production

# Expose ports for app and mediasoup UDP range
EXPOSE 3000
EXPOSE 46000-46999/udp

# Start the Bun app
CMD ["bun", "run", "src/index.ts"]
