export interface RpcReceiptLog {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
}

export interface RpcAccessListEntry {
    address: string;
    storageKeys: string[];
}

export interface RpcTxReceipt {
    blockHash: string;
    blockNumber: string;
    contractAddress: string | null;
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    from: string;
    gasUsed: string;
    logs: RpcReceiptLog[];
    logsBloom: string;
    status: string;
    to: string;
    transactionHash: string;
    transactionIndex: string;
    type: string;
}

export interface RpcBlockTransaction {
    hash: string;
    blockHash: string;
    blockNumber: string;
    transactionIndex: string;
    from: string;
    to: string | null;
    value: string;
    gas: string;
    gasPrice: string;
    input: string;
    nonce: string;
    type: string;
    chainId: string;
    v: string;
    r: string;
    s: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    accessList?: RpcAccessListEntry[];
    yParity?: string;
}

export interface RpcBlock {
    hash: string;
    number: string;
    parentHash: string;
    timestamp: string;
    gasLimit: string;
    gasUsed: string;
    baseFeePerGas: string;
    miner: string;
    difficulty: string;
    totalDifficulty: string;
    size: string;
    stateRoot: string;
    transactionsRoot: string;
    receiptsRoot: string;
    logsBloom: string;
    extraData: string;
    mixHash: string;
    nonce: string;
    sha3Uncles: string;
    uncles: string[];
    transactions: RpcBlockTransaction[];
    blobGasUsed?: string;
    excessBlobGas?: string;
    parentBeaconBlockRoot?: string;
    blockGasCost?: string;
}

export const TRACE_CALL_TYPES = [
    'CALL',
    'DELEGATECALL',
    'STATICCALL',
    'CALLCODE',
    'CREATE',
    'CREATE2',
    'SELFDESTRUCT',
    'SUICIDE',
    'REWARD'
] as const;

export interface RpcTraceCall {
    from: string;
    gas: string;
    gasUsed: string;
    to: string;
    input: string;
    value: string;
    type: (typeof TRACE_CALL_TYPES)[number];
    calls?: RpcTraceCall[];
}

export interface RpcTraceResult {
    txHash: string;
    result: RpcTraceCall;
}

export interface RpcTraceResponse {
    jsonrpc: string;
    id: number;
    result: RpcTraceResult[];
}
