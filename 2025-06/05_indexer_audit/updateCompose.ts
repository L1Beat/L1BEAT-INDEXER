import fs from "fs";
import { fetchBlockchainIDFromPrecompile } from "./lib/rpc";
import YAML from 'yaml'

const rpcUrls = fs.readFileSync("rpcs.txt", "utf8").split("\n").filter(url => url.trim() !== "");

const services: Record<string, any> = {}

const chainIds: Record<string, string> = {}

await Promise.all(rpcUrls.map(async (rpcUrl) => {
    const blockchainID = await fetchBlockchainIDFromPrecompile(rpcUrl);
    chainIds[rpcUrl] = blockchainID;
}))

let port = 3000;
for (const rpcUrl of rpcUrls) {
    port++;

    const blockchainID = chainIds[rpcUrl];
    if (!blockchainID) {
        throw new Error(`Blockchain ID not found for ${rpcUrl}`);
    }

    services[`indexer_${blockchainID}`] = {
        image: "containerman17/lean-explorer-core:latest",
        container_name: `indexer_${blockchainID}`,
        environment: {
            RPC_URL: rpcUrl,
            CHAIN_ID: blockchainID,
            DATA_DIR: "/data/",
            RPS: "20",
            REQUEST_BATCH_SIZE: "100",
            MAX_CONCURRENT: "20", //RPS is also max concurrent
            BLOCKS_PER_BATCH: "1000"
        },
        volumes: [
            "/home/ubuntu/experiments/2025-06/05_indexer_audit/database:/data"
        ],
        ports: [
            `${port}:3000`
        ],
        restart: "on-failure:5" // Add restart policy with sane limit
    }
}


const composeObject = {
    services
}
const yamlStr = YAML.stringify(composeObject)
fs.writeFileSync('compose.yml', yamlStr)
