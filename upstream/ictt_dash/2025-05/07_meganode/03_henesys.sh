#! /bin/bash

set -exu

mkdir -p ~/.avalanchego/configs/vms
 
cat > ~/.avalanchego/configs/vms/aliases.json <<EOF
{
  "YtGKetwQgUADapTEJBQCfS2EcH55x4hyjrFiJBaooiUd1X17v": ["srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"]
}
EOF

mkdir -p ~/.avalanchego/configs/chains/2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB
cat >  ~/.avalanchego/configs/chains/2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB/config.json <<EOF
{
  "pruning-enabled": false
}
EOF

docker run -it -d \
    --name avago \
    --network host \
    -v ~/.avalanchego:/root/.avalanchego \
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \
    -e AVAGO_HTTP_HOST=0.0.0.0 \
    -e AVAGO_TRACK_SUBNETS=jmLmezoViv3F72XLzpdmSNk3qLEGb72g5EYkp3ij4wHXPF2KN \
    -e VM_ID=YtGKetwQgUADapTEJBQCfS2EcH55x4hyjrFiJBaooiUd1X17v \
    avaplatform/subnet-evm:v0.7.3
