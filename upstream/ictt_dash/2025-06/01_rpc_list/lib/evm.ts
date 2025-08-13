import fetch from "node-fetch";
import pThrottle from "p-throttle";
import { utils } from "@avalabs/avalanchejs";

const throttle = pThrottle({
    limit: 20,
    interval: 1000
});

let requestsLeft = 0
setInterval(() => {
    if (requestsLeft > 0) {
        console.log(`EVM requests left: ${requestsLeft}`)
    }
}, 1000)

export async function throttledFetch(rpcUrl: string, method: string, params: any[]) {
    try {
        requestsLeft += 1
        return await throttle(fetch)(rpcUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ jsonrpc: "2.0", method: method, params: params, id: 1 })
        })
    } finally {
        requestsLeft -= 1
    }
}

export async function fetchEVMChainId(rpcUrl: string) {
    const response = await throttledFetch(rpcUrl, "eth_chainId", [])
    const responseText = await response.text()

    try {
        const data = JSON.parse(responseText) as { result: string }
        return parseInt(data.result, 16)
    } catch (error) {
        throw new Error(`Failed to parse JSON response. First 200 chars of body: ${responseText.slice(0, 200)}`)
    }
}

export async function fetchLastBlockNumber(rpcUrl: string) {
    const response = await throttledFetch(rpcUrl, "eth_blockNumber", [])
    const data = await response.json() as { result: string }
    return parseInt(data.result, 16)
}

type EVMBlock = {
    baseFeePerGas: string,
    blobGasUsed: string,
    blockGasCost: string,
    difficulty: string,
    excessBlobGas: string,
    extraData: string,
    gasLimit: string,
    gasUsed: string,
    hash: string,
    logsBloom: string,
    miner: string,
    mixHash: string,
    nonce: string,
    number: string,
    parentBeaconBlockRoot: string,
    parentHash: string,
    receiptsRoot: string,
    sha3Uncles: string,
    size: string,
    stateRoot: string,
    timestamp: string,
    totalDifficulty: string,
    transactions: string[],
    transactionsRoot: string,
    uncles: string[]
}

export async function fetchBlockByNumber(rpcUrl: string, blockNumber: string) {
    const response = await throttledFetch(rpcUrl, "eth_getBlockByNumber", [blockNumber, false])
    const data = await response.json() as { result: EVMBlock }
    return data.result
}

export async function fetchBlockchainIDFromPrecompile(rpcUrl: string): Promise<string> {
    const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005';
    const getBlockchainIDFunctionSignature = '0x4213cf78';

    const response = await throttledFetch(rpcUrl, "eth_call", [
        {
            to: WARP_PRECOMPILE_ADDRESS,
            data: getBlockchainIDFunctionSignature
        },
        "latest"
    ]);

    const data = await response.json() as { result: string };
    const result = data.result;

    if (typeof result !== 'string' || !result.startsWith('0x')) {
        throw new Error('Invalid result format for blockchain ID from precompile.');
    }

    const chainIdBytes = utils.hexToBuffer(result);
    const avalancheChainId = utils.base58check.encode(chainIdBytes);

    return avalancheChainId;
}

export async function testDebugFunctionality(rpcUrl: string): Promise<boolean> {
    try {
        // Try to use debug_traceBlockByNumber on block 0 (genesis block) to test if RPC supports debug functionality
        const response = await throttledFetch(rpcUrl, "debug_traceBlockByNumber", ["0x1", {}]);
        const data = await response.json() as { result?: any, error?: any };

        // If we get a result without error, debug functionality is available
        return !data.error && data.result !== undefined;
    } catch (error) {
        // If any error occurs, debug functionality is not available
        return false;
    }
}
