#!/usr/bin/env bun

import { getNodeIps, applyDockerCompose } from "./lib";
import fs from 'fs';

// Load chains configuration
const chains = JSON.parse(fs.readFileSync('chains.json', 'utf8')) as Record<string, { subnetId: string, chainId: string }>;
console.log("Loaded chains:", Object.keys(chains));

const clusters = getNodeIps();
console.log("Found clusters:", Object.keys(clusters));

const promises = []
// Deploy to each cluster with its corresponding subnet ID
for (const [clusterName, ips] of Object.entries(clusters)) {
    const chainConfig = chains[clusterName];
    if (!chainConfig) {
        console.warn(`Warning: No chain configuration found for cluster ${clusterName}, skipping...`);
        continue;
    }

    const subnetId = chainConfig.subnetId;

    const benchIp = ips[0] as string;
    const avagoIps = ips.slice(1);

    const benchURLS = avagoIps.map(ip => `http://${ip}:9650/ext/bc/${chainConfig.chainId}/rpc`);

    promises.push(applyDockerCompose(benchIp, subnetId, ["bench"], benchURLS, true));
}

await Promise.all(promises)

console.log("All subnets have been successfully tracked!");
