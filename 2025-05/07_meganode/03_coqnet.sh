#! /bin/bash

set -exu

mkdir -p ~/.avalanchego_coqnet/configs/vms
 
cat > ~/.avalanchego_coqnet/configs/vms/aliases.json <<EOF
{
  "knwdavfavsrcds7PKZmVBd5iZGXkhRQsC9xUHzSNHdegDCWBL": ["srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"]
}
EOF

mkdir -p ~/.avalanchego_coqnet/configs/chains/23aQU1537YseCJmXW11XHjPra6bptBSps5D4xXupt8hN2QUeaG
cat >  ~/.avalanchego_coqnet/configs/chains/23aQU1537YseCJmXW11XHjPra6bptBSps5D4xXupt8hN2QUeaG/config.json <<EOF
{
  "pruning-enabled": false
}
EOF

docker run -it -d \
    --name coqnet \
    --network host \
    -v ~/.avalanchego_coqnet:/root/.avalanchego \
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \
    -e AVAGO_HTTP_HOST=0.0.0.0 \
    -e AVAGO_HTTP_PORT=9654 \
    -e AVAGO_STAKING_PORT=9655 \
    -e AVAGO_TRACK_SUBNETS=5moznRzaAEhzWkNTQVdT1U4Kb9EU7dbsKZQNmHwtN5MGVQRyT \
    -e VM_ID=knwdavfavsrcds7PKZmVBd5iZGXkhRQsC9xUHzSNHdegDCWBL \
    avaplatform/subnet-evm:v0.7.3
