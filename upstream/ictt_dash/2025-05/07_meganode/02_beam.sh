mkdir -p ~/.avalanchego_beam/configs/chains/2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn
 
wget -O ~/.avalanchego_beam/configs/chains/2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn/upgrade.json https://raw.githubusercontent.com/BuildOnBeam/beam-subnet/main/subnets/beam-mainnet/upgrade.json

mkdir -p ~/.avalanchego_beam/configs/vms
 
cat > ~/.avalanchego_beam/configs/vms/aliases.json <<EOF
{
  "kLPs8zGsTVZ28DhP1VefPCFbCgS7o5bDNez8JUxPVw9E6Ubbz": ["srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"]
}
EOF

cat >  ~/.avalanchego_beam/configs/chains/2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn/config.json <<EOF
{
  "pruning-enabled": false
}
EOF

docker stop beam || true
docker rm beam || true

docker run -it -d \
    --name beam \
    --network host \
    --restart always \
    -v ~/.avalanchego_beam:/root/.avalanchego \
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \
    -e AVAGO_HTTP_HOST=0.0.0.0 \
    -e AVAGO_HTTP_PORT=9652 \
    -e AVAGO_STAKING_PORT=9653 \
    -e AVAGO_TRACK_SUBNETS=eYwmVU67LmSfZb1RwqCMhBYkFyG8ftxn6jAwqzFmxC9STBWLC \
    -e VM_ID=kLPs8zGsTVZ28DhP1VefPCFbCgS7o5bDNez8JUxPVw9E6Ubbz \
    avaplatform/subnet-evm:v0.7.3
