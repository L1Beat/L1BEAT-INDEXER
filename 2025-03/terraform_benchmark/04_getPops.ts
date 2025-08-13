#! /usr/bin/env bun

import { executeCommandEveryIp } from "./lib.ts";

await executeCommandEveryIp(`
docker stop avago || true &&
docker rm avago || true &&
docker run -it -d \\
    --name avago \\
    --network host \\
    -v ~/.avalanchego:/root/.avalanchego \\
    -e AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=true \\
    -e AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns \\
    -e AVAGO_NETWORK_ID=fuji \\
    martineck/subsecond-blocktime &&
sleep 3 &&
curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info
`);
