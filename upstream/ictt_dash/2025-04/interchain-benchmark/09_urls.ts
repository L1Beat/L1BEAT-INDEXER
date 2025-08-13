#!/usr/bin/env bun

import { getNodeIps } from "./lib";
import fs from 'fs';

// Load chains configuration
const chains = JSON.parse(fs.readFileSync('chains.json', 'utf8')) as Record<string, { subnetId: string, chainId: string }>;
console.log("Loaded chains:", Object.keys(chains));

const clusters = getNodeIps();
console.log("Found clusters:", Object.keys(clusters));

for (const [clusterName, ips] of Object.entries(clusters)) {
    const chainConfig = chains[clusterName];
    if (!chainConfig) {
        console.warn(`Warning: No chain configuration found for cluster ${clusterName}, skipping...`);
        continue;
    }

    const firstNonBenchIp = ips.slice(1)[0] as string;

    console.log(`wss://${firstNonBenchIp}.sslip.io/ext/bc/${chainConfig.chainId}/ws`)
}

