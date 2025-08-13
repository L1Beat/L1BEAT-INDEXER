#!/bin/bash

set -uxe

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

npx tsx index.ts
scp compose.yml nginx.conf $REMOTE_SERVER_USER@$REMOTE_SERVER_IP:/home/ilia/
ssh $REMOTE_SERVER_USER@$REMOTE_SERVER_IP "cd /home/ilia && docker compose pull && docker compose up -d --remove-orphans; docker restart nginx"
