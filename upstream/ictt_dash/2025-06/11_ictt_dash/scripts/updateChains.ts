import { ChainConfig } from "frostbyte-sdk";

//@ts-ignore don't want to install @types/node just for this
import fs from "fs";

// TODO: Remember to handle excluded chains - currently excluding Avalanche C-Chain (43114)
const EXCLUDED_CHAIN_IDS = {
    // 43114: "Avalanche C-Chain" // Exclude this chain from processing
};

type ChainFromJson = {
    chainName: string;
    blockchainId: string;
    subnetId: string;
    rpcUrl: string;
    evmChainId: number;
    blocksCount: number;
    estimatedTxCount: number;
    comment: string;
    debugEnabled: boolean;
}

let chains: ChainFromJson[] = JSON.parse(fs.readFileSync("../01_rpc_list/data/chains.json", "utf8"));

if (fs.existsSync("./secretChains.json")) {
    const secretChains: ChainFromJson[] = JSON.parse(fs.readFileSync("./secretChains.json", "utf8"));

    for (const chain of secretChains) {
        const chainExists = chains.find(c => c.blockchainId === chain.blockchainId);
        if (chainExists) {
            chains = chains.filter(c => c.blockchainId !== chain.blockchainId);
        }
        chains.push(chain);
    }
}
const result: ChainConfig[] = [];

// Get optional max chains limit from command line argument
const debugFilterChainIds = process.argv[2] ? process.argv[2].split(',') : undefined;

const FORCE_DISABLE_DEBUG = true

const RPS_PER_HOST = {
    "meganode.solokhin.com": 20000,
    "65.21.140.118": 20000,  // meganode IP should have same RPS
    "subnets.avax.network": 20,
    "api.avax.network": 20,
    "default": 20,
    "142.132.150.152": 100000,
}

const DISABLE_BLOCK_GROWTH = [
    "meganode.solokhin.com",
    "65.21.140.118",  // meganode IP should also disable block growth
]

const MAX_CONCURRENCY_PER_HOST = {
    "meganode.solokhin.com": 300,
    "65.21.140.118": 300,  // meganode IP should have same concurrency  
    "subnets.avax.network": 100,
    "api.avax.network": 100,
    "rpc.step.network": 100,
    "rpc.amichain.org": 100,
    "rpc-codenekt-mainnet.cogitus.io": 100,
    "default": 100,
    "142.132.150.152": 300,
}

const REQUEST_BATCH_SIZE_PER_HOST = {
    "default": 10,
    "subnets.avax.network": 4,
}

const URL_REPLACEMENTS = {
    "https://meganode.solokhin.com/": "http://65.21.140.118/",
}

const DEFAULT_REQUEST_BATCH_SIZE = 10
const DEFAULT_BLOCKS_PER_BATCH = 500

// First pass: determine final URLs and count chains per final host
const hostCounts: { [host: string]: number } = {};
const chainWithFinalUrls: Array<{ chain: ChainFromJson, finalRpcUrl: string, finalHost: string }> = [];

for (const chain of chains) {
    if (!chain.evmChainId || !chain.rpcUrl) {
        continue;
    }

    // Skip excluded chains
    if (EXCLUDED_CHAIN_IDS[chain.evmChainId]) {
        console.log(`Skipping excluded chain: ${chain.chainName} (evmChainId: ${chain.evmChainId})`);
        continue;
    }

    // Determine final RPC URL - skip URL replacements for secret chains
    let finalRpcUrl = chain.rpcUrl;

    const finalUrl = new URL(finalRpcUrl);
    let finalHost = finalUrl.hostname;

    // Count based on final host
    hostCounts[finalHost] = (hostCounts[finalHost] || 0) + 1;

    chainWithFinalUrls.push({ chain, finalRpcUrl, finalHost });
}

// Second pass: create chain configs with calculated RPS and maxConcurrentRequests based on final hosts
for (const { chain, finalRpcUrl, finalHost } of chainWithFinalUrls) {
    const enableBatchSizeGrowth = !DISABLE_BLOCK_GROWTH.includes(finalHost);

    const hostRps = RPS_PER_HOST[finalHost] || RPS_PER_HOST["default"];
    const hostMaxConcurrency = MAX_CONCURRENCY_PER_HOST[finalHost] || MAX_CONCURRENCY_PER_HOST["default"];
    const hostRequestBatchSize = REQUEST_BATCH_SIZE_PER_HOST[finalHost] || REQUEST_BATCH_SIZE_PER_HOST["default"];
    const chainCount = hostCounts[finalHost];
    const rpsPerChain = Math.ceil(hostRps / chainCount);
    const maxConcurrentRequestsPerChain = Math.ceil(hostMaxConcurrency / chainCount);

    result.push({
        "chainName": chain.chainName,
        "blockchainId": chain.blockchainId,
        "evmChainId": Number(chain.evmChainId),
        "rpcConfig": {
            "rpcUrl": finalRpcUrl,
            "requestBatchSize": hostRequestBatchSize,
            "maxConcurrentRequests": maxConcurrentRequestsPerChain,
            "rps": rpsPerChain,
            "rpcSupportsDebug": chain.debugEnabled && !FORCE_DISABLE_DEBUG,
            "enableBatchSizeGrowth": enableBatchSizeGrowth,
            "blocksPerBatch": DEFAULT_BLOCKS_PER_BATCH
        },

    },);
}
// Limit the number of chains if maxChains is specified
const finalResult = debugFilterChainIds ? result.filter(chain => debugFilterChainIds.includes(chain.blockchainId)) : result;
// Ensure data directory exists
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", { recursive: true });
}

fs.writeFileSync("./prod_chains.json", JSON.stringify(finalResult, null, 2));
console.log(`Saved ${finalResult.length} chains in prod_chains.json${debugFilterChainIds ? ` (limited to ${debugFilterChainIds})` : ''}`);
