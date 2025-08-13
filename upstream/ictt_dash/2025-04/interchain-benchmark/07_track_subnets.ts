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
    console.log(`Updating cluster ${clusterName} with subnetId: ${subnetId}`);

    // Skip the first node (benchmarking machine)
    const avagoIps = ips.slice(1);
    console.log(`Deploying to ${avagoIps.length} nodes in cluster ${clusterName}`);

    for (const avagoIp of avagoIps) {
        // Deploy both avago and caddy services
        promises.push(applyDockerCompose(avagoIp, subnetId, ["avago", "caddy"], []));
    }
}

await Promise.all(promises)

console.log("All subnets have been successfully tracked with Caddy reverse proxies configured!");
