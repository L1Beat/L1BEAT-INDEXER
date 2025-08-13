#!/usr/bin/env bun

import { getNodeIps, applyDockerCompose } from "./lib";

// Get subnetId from command line or environment, default to empty string
const subnetId = process.env.SUBNET_ID || "";
console.log(`Using subnetId: ${subnetId || "(empty)"}`);

const clusters = getNodeIps();

console.log("Found clusters:", Object.keys(clusters));

let totalNodeCount = 0;
let skipCount = 0;

const promises = []
// Process each cluster separately
for (const [clusterName, ips] of Object.entries(clusters)) {
    console.log(`Processing cluster ${clusterName} with ${ips.length} nodes...`);

    // Skip the first machine (benchmarking machine)
    const validNodes = ips.slice(1);
    skipCount += ips.length - validNodes.length;
    totalNodeCount += validNodes.length;

    // Deploy to each node in parallel
    const deployPromises = validNodes.map(ip => applyDockerCompose(ip, subnetId, ["avago"]));
    promises.push(Promise.all(deployPromises));

}

await Promise.all(promises)

console.log(`Deployment completed! Deployed to ${totalNodeCount} nodes, skipped ${skipCount} benchmarking nodes.`);
