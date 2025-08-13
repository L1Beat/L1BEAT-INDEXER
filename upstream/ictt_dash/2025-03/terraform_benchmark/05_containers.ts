#! /usr/bin/env bun

import { executeCommandEveryIp } from "./lib.ts";
import { subnetId, delay } from "./00_values.ts";

await executeCommandEveryIp((ip) => `
docker stop avago || true;
docker rm avago || true;
if [ -z "$(sudo docker ps -a -q -f name=caddy)" ]; then
  docker run -d \\
    --name caddy \\
    --network host \\
    -v caddy_data:/data \\
    caddy:2.8-alpine \\
    caddy reverse-proxy --from ${ip}.sslip.io --to localhost:9650
else
  echo "Caddy container already exists, skipping creation."
fi

sudo docker stop avago || true; 
sudo docker rm avago || true; 
sudo docker run -it -d \\
    --name avago \\
    --network host \\
    -v ~/.avalanchego:/root/.avalanchego \\
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \\
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \\
    -e AVAGO_HTTP_HOST=0.0.0.0 \\
    -e AVAGO_TRACK_SUBNETS=${subnetId} \\
    -e AVAGO_NETWORK_ID=fuji \\
    -e AVAGO_HTTP_ALLOWED_HOSTS="*" \\
    -e AVAGO_PROPOSERVM_MIN_BLOCK_DELAY=${delay} \\
    martineck/subsecond-blocktime
`, true);
