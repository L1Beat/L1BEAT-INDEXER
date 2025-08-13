import { utils } from "@avalabs/avalanchejs";

async function makeRpcCall<T>(rpcUrl: string, method: string, params: any[]): Promise<T> {
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: 1,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} url: ${rpcUrl}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
}


export async function fetchBlockchainIDFromPrecompile(rpcUrl: string): Promise<string> {
    const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005';
    const getBlockchainIDFunctionSignature = '0x4213cf78';

    const result = await makeRpcCall<string>(rpcUrl, 'eth_call', [
        {
            to: WARP_PRECOMPILE_ADDRESS,
            data: getBlockchainIDFunctionSignature
        },
        "latest"
    ]);

    if (typeof result !== 'string' || !result.startsWith('0x')) {
        throw new Error('Invalid result format for blockchain ID from precompile.');
    }

    const chainIdBytes = utils.hexToBuffer(result);
    const avalancheChainId = utils.base58check.encode(chainIdBytes);

    return avalancheChainId;
}

export interface BlockTransaction {
    blockHash: string;
    blockNumber: string;
    from: string;
    gas: string;
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    hash: string;
    input: string;
    nonce: string;
    to: string;
    transactionIndex: string;
    value: string;
    type: string;
    accessList: any[];
    chainId: string;
    v: string;
    r: string;
    s: string;
    yParity: string;
}

export interface BlockData {
    baseFeePerGas: string;
    blobGasUsed: string;
    blockGasCost: string;
    difficulty: string;
    excessBlobGas: string;
    extraData: string;
    gasLimit: string;
    gasUsed: string;
    hash: string;
    logsBloom: string;
    miner: string;
    mixHash: string;
    nonce: string;
    number: string;
    parentBeaconBlockRoot: string;
    parentHash: string;
    receiptsRoot: string;
    sha3Uncles: string;
    size: string;
    stateRoot: string;
    timestamp: string;
    totalDifficulty: string;
    transactions: BlockTransaction[];
    transactionsRoot: string;
    uncles: any[];
}

export async function fetchBlockData(rpcUrl: string, blockNumber: number): Promise<BlockData> {
    const result = await makeRpcCall<BlockData>(rpcUrl, 'eth_getBlockByNumber', [
        `0x${blockNumber.toString(16)}`, // Convert to hex
        true // Include full transaction objects
    ]);

    if (!result) {
        throw new Error('Block not found');
    }

    return result;
} 
