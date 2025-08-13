#!/bin/bash

docker stop indexer || true
docker rm indexer || true

docker run -it -d \
  --name indexer \
  -p 127.0.0.1:9654:9654 -p 9655:9655 \
  -v ~/.avalanchego_indexer:/root/.avalanchego \
  -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \
  -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \
  -e AVAGO_HTTP_HOST=0.0.0.0 \
  -e AVAGO_HTTP_PORT=9654 \
  -e AVAGO_STAKING_PORT=9655 \
  -e AVAGO_NETWORK_ID=fuji \
  -e AVAGO_HTTP_ALLOWED_HOSTS="*" \
  -e AVAGO_INDEX_ENABLED=true \
  avaplatform/subnet-evm:v0.7.3
