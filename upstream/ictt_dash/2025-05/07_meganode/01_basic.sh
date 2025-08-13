#!/bin/bash

docker stop avago || true
docker rm avago || true

docker run -it -d \
    --name avago \
    --network host \
    -v ~/.avalanchego:/root/.avalanchego \
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \
    -e AVAGO_HTTP_HOST=0.0.0.0 \
    -e AVAGO_HTTP_PORT=9650 \
    -e AVAGO_STAKING_PORT=9651 \
    -e AVAGO_HTTP_ALLOWED_HOSTS="*" \
    avaplatform/subnet-evm:v0.7.3
