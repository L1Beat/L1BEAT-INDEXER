import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'yaml';
import { IndexerClient } from './lib/indexer';
import { stringify } from "csv-stringify/sync";
import { fetchBlockchainIDFromPrecompile, fetchBlockData } from './lib/rpc';
import { Avalanche } from "@avalanche-sdk/data";
import { Blockchain } from '@avalanche-sdk/data/models/components/blockchain.js';
import { getGlacierChains, GlacierBlockchain, GlacierChain, listAllBlockchains, listAllBlockchainsCached } from './lib/glacier';

// Read and parse the compose.yml file
const composeContent = readFileSync('./compose.yml', 'utf8');
const composeData = parse(composeContent);

const avalanche = new Avalanche({
});

// Extract local ports from all services

const indexerUrlToOriginalRPC: Record<string, string> = {};
const localhostUrls: string[] = [];
if (composeData.services) {
    for (const serviceName in composeData.services) {
        const service = composeData.services[serviceName];
        const originalRPC = service.environment?.RPC_URL;

        if (service.ports && Array.isArray(service.ports)) {
            for (const portMapping of service.ports) {
                // Port mapping can be either "3001:3000" or just 3001
                const portStr = portMapping.toString();
                if (portStr.includes(':')) {
                    // Extract the local port (before the colon)
                    const localPort = parseInt(portStr.split(':')[0]);
                    if (!isNaN(localPort)) {
                        localhostUrls.push(`http://localhost:${localPort}`);
                        indexerUrlToOriginalRPC[`http://localhost:${localPort}`] = originalRPC;
                    }
                } else {
                    // If no colon, it's just a port number
                    const port = parseInt(portStr);
                    if (!isNaN(port)) {
                        localhostUrls.push(`http://localhost:${port}`);
                        indexerUrlToOriginalRPC[`http://localhost:${port}`] = originalRPC;
                    }
                }
            }
        }
    }
}
// Read additional indexer URLs from addIndexers.txt
const additionalIndexers: string[] = [];
try {
    const addIndexersContent = readFileSync('./addIndexers.txt', 'utf8');
    const urlPairs = addIndexersContent
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0 && url.startsWith('http'))
        .map(url => url.split(';'));

    for (const urlPair of urlPairs) {
        const [indexerUrl, originalRPC] = urlPair;
        additionalIndexers.push(indexerUrl);
        indexerUrlToOriginalRPC[indexerUrl] = originalRPC;
    }
} catch (error) {
    console.log('addIndexers.txt not found or could not be read');
}

// Combine all URLs
const allIndexerUrls = [...localhostUrls, ...additionalIndexers];

const JUNE_2025_START_TIME = 1748736000;
const MAY_2025_START_TIME = 1746057600;
const APRIL_2025_START_TIME = 1743465600;

async function collectMetrics(rpcUrls: string) {
    const client = new IndexerClient(rpcUrls);
    const status = await client.getStatus();
    const txCountMetrics = await client.getTxCountMetrics();
    return {
        "Caught up": status.caughtUp ? "Yes" : "No",
        "Latest block number": status.latestBlockNumber,
        "Tx June": txCountMetrics.filter(metric => metric.timestamp >= JUNE_2025_START_TIME)[0]?.value || 0,
        "Tx May": txCountMetrics.filter(metric => metric.timestamp >= MAY_2025_START_TIME && metric.timestamp < JUNE_2025_START_TIME)[0]?.value || 0,
        "Tx April": txCountMetrics.filter(metric => metric.timestamp >= APRIL_2025_START_TIME && metric.timestamp < MAY_2025_START_TIME)[0]?.value || 0,
    }
}

let testNetChains: GlacierBlockchain[] = await listAllBlockchainsCached('testnet')
let mainNetChains: GlacierBlockchain[] = await listAllBlockchainsCached('mainnet')

// Collect all results first
const results: string[][] = [];
results.push(["Network", "Is testnet", "Indexer caught up", "Latest block number", "Tx April", "Tx May", "Tx June", "First block date"]);

for (const url of allIndexerUrls) {
    const originalRPC = indexerUrlToOriginalRPC[url];
    const metrics = await collectMetrics(url);
    let firstBlockDate = 'N/A';
    if (metrics['Latest block number'] !== 0) {
        try {
            const blockData = await fetchBlockData(indexerUrlToOriginalRPC[url], 1);
            const timestampNum = parseInt(blockData.timestamp, 16);
            const date = new Date(timestampNum * 1000);
            firstBlockDate = date.toISOString().slice(0, 10);
        } catch (e) {
            firstBlockDate = 'error';
        }
    }

    let fromGlacier: GlacierBlockchain | undefined = undefined

    const blockchainId = await fetchBlockchainIDFromPrecompile(indexerUrlToOriginalRPC[url]);
    let netMode = "devnet"
    if (testNetChains.find(chain => chain.blockchainId === blockchainId)) {
        fromGlacier = testNetChains.find(chain => chain.blockchainId === blockchainId)
        netMode = "testnet"
    } else if (mainNetChains.find(chain => chain.blockchainId === blockchainId)) {
        fromGlacier = mainNetChains.find(chain => chain.blockchainId === blockchainId)
        netMode = "mainnet"
    }

    const chainName = fromGlacier?.blockchainName || originalRPC

    results.push([
        chainName,
        netMode,
        metrics["Caught up"],
        metrics["Latest block number"].toString(),
        metrics["Tx April"].toString(),
        metrics["Tx May"].toString(),
        metrics["Tx June"].toString(),
        firstBlockDate,
    ]);
}

// Output as CSV
const csvOutput = stringify(results);
writeFileSync('./results.csv', csvOutput);
