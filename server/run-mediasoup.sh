#!/bin/bash

ENV_FILE=".env"
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: Environment file '$ENV_FILE' not found.${NC}"
  exit 1
fi

echo -e "${GREEN}Detecting current local IP...${NC}"
LOCAL_IP=$(hostname -I | awk '{print $1}')

if [ -z "$LOCAL_IP" ]; then
  echo -e "${RED} Could not detect local IP. Are you connected to Wi-Fi?${NC}"
  exit 1
fi

echo -e "${GREEN}Updating .env with MEDIASOUP_ANNOUNCED_IP=$LOCAL_IP${NC}"
sed -i.bak "s/^MEDIASOUP_ANNOUNCED_IP=.*/MEDIASOUP_ANNOUNCED_IP=$LOCAL_IP/" "$ENV_FILE"
rm -f "$ENV_FILE.bak"

mkdir -p recordings

echo -e "${GREEN}Starting Mediasoup server...${NC}"
bun run src/index.ts
#r: npm run dev
