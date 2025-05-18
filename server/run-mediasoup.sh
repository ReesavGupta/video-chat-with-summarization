#!/bin/bash

# === CONFIG ===
IMAGE_NAME="mediasoup-bun-server"
CONTAINER_NAME="mediasoup-server-container"
RECORDINGS_DIR="$(pwd)/recordings"
ENV_FILE=".env"
USE_HOST_NETWORK=false  # Set to false for macOS/WSL/Windows; true only for Linux native

GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m"

# === PRECHECK ===
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Error: Environment file '$ENV_FILE' not found.${NC}"
  exit 1
fi

# === DETECT LOCAL IP ===
echo -e "${GREEN}🔍 Detecting current local IP...${NC}"
LOCAL_IP=$(ipconfig | grep -A 10 "Wi-Fi" | grep "IPv4 Address" | awk -F: '{print $2}' | xargs)

if [ -z "$LOCAL_IP" ]; then
  echo -e "${RED}❌ Could not detect local IP. Are you connected to Wi-Fi?${NC}"
  exit 1
fi

# === UPDATE .env WITH CURRENT IP ===
echo -e "${GREEN}🌐 Updating .env with MEDIASOUP_ANNOUNCED_IP=$LOCAL_IP${NC}"
sed -i.bak "s/^MEDIASOUP_ANNOUNCED_IP=.*/MEDIASOUP_ANNOUNCED_IP=$LOCAL_IP/" "$ENV_FILE"
rm -f "$ENV_FILE.bak"

# === BUILD ===
echo -e "${GREEN}🔧 Building Docker image: $IMAGE_NAME...${NC}"
docker build -t $IMAGE_NAME .

# === CREATE RECORDINGS DIR IF NEEDED ===
mkdir -p "$RECORDINGS_DIR"

# === RUN ===
echo -e "${GREEN}🚀 Running container...${NC}"

if [ "$USE_HOST_NETWORK" = true ]; then
  docker run --rm --name $CONTAINER_NAME --network host \
    -v "$RECORDINGS_DIR:/app/src/public/recordings" \
    --env-file "$ENV_FILE" \
    $IMAGE_NAME

  echo -e "${GREEN}🌐 Server running at http://localhost:3000 (host network)${NC}"
else
  docker run --rm -d --name $CONTAINER_NAME \
    -p 3001:3001 \
    -p 46000-46999:46000-46999/udp \
    -v "$RECORDINGS_DIR:/app/src/public/recordings" \
    --env-file "$ENV_FILE" \
    $IMAGE_NAME

  echo -e "${GREEN}🌐 Server running at http://localhost:3001 (port-mapped)${NC}"
fi
