import chains from "../../01_rpc_list/data/chains.json";
import { ChainConfig } from "frostbyte-sdk";

const result: ChainConfig[] = [];

// Get optional max chains limit from command line argument
const debugFilterChainIds = process.argv[2] ? process.argv[2].split(',') : undefined;

const FORCE_DISABLE_DEBUG = true

const RPS_PER_HOST = {
    "meganode.solokhin.com": 10000,
    "subnets.avax.network": 20,
    "api.avax.network": 20,
    "default": 20,
}

const DISABLE_BLOCK_GROWTH = [
    "meganode.solokhin.com",
]

const MAX_CONCURRENCY_PER_HOST = {
    "meganode.solokhin.com": 300,
    "subnets.avax.network": 100,
    "api.avax.network": 100,
    "rpc.step.network": 100,
    "rpc.amichain.org": 100,
    "rpc-codenekt-mainnet.cogitus.io": 100,
    "default": 100,
}

const URL_REPLACEMENTS = {
    "https://meganode.solokhin.com/": "http://65.21.140.118/"
}

const DEFAULT_REQUEST_BATCH_SIZE = 10
const DEFAULT_BLOCKS_PER_BATCH = 300

// First pass: count chains per host
const hostCounts: { [host: string]: number } = {};

for (const chain of chains) {
    if (!chain.evmChainId || !chain.rpcUrl) {
        continue;
    }

    const url = new URL(chain.rpcUrl);
    const host = url.hostname;

    hostCounts[host] = (hostCounts[host] || 0) + 1;
}

// Second pass: create chain configs with calculated RPS and maxConcurrentRequests
for (const chain of chains) {
    if (!chain.evmChainId || !chain.rpcUrl) {
        continue;
    }

    const url = new URL(chain.rpcUrl);
    const host = url.hostname;


    const enableBatchSizeGrowth = !DISABLE_BLOCK_GROWTH.includes(host);

    const hostRps = RPS_PER_HOST[host] || RPS_PER_HOST["default"];
    const hostMaxConcurrency = MAX_CONCURRENCY_PER_HOST[host] || MAX_CONCURRENCY_PER_HOST["default"];
    const chainCount = hostCounts[host];
    const rpsPerChain = Math.ceil(hostRps / chainCount);
    const maxConcurrentRequestsPerChain = Math.ceil(hostMaxConcurrency / chainCount);

    // Apply URL replacements
    let rpcUrl = chain.rpcUrl;
    for (const [from, to] of Object.entries(URL_REPLACEMENTS)) {
        rpcUrl = rpcUrl.replace(from, to);
    }

    //TODO: remove
    // if (chain.rpcUrl.includes("subnets.avax.network")) {
    //     console.log(`WARNING: ${chain.chainName} is using subnets.avax.network, due to temporary issues, disabled`);
    //     continue;
    // }

    result.push({
        "chainName": chain.chainName,
        "blockchainId": chain.blockchainId,
        "evmChainId": Number(chain.evmChainId),
        "rpcConfig": {
            "rpcUrl": rpcUrl,
            "requestBatchSize": DEFAULT_REQUEST_BATCH_SIZE,
            "maxConcurrentRequests": maxConcurrentRequestsPerChain,
            "rps": rpsPerChain,
            "rpcSupportsDebug": chain.debugEnabled && !FORCE_DISABLE_DEBUG,
            "enableBatchSizeGrowth": enableBatchSizeGrowth,
            "blocksPerBatch": DEFAULT_BLOCKS_PER_BATCH
        },

    },);
}

import fs from "fs";
// Limit the number of chains if maxChains is specified
const finalResult = debugFilterChainIds ? result.filter(chain => debugFilterChainIds.includes(chain.blockchainId)) : result;
// Ensure data directory exists
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", { recursive: true });
}

fs.writeFileSync("./prod_chains.json", JSON.stringify(finalResult, null, 2));
console.log(`Saved ${finalResult.length} chains in prod_chains.json${debugFilterChainIds ? ` (limited to ${debugFilterChainIds})` : ''}`);
