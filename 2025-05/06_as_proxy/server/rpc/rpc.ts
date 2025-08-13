import { createPublicClient, http, type Block, type Chain, type GetBlockReturnType, type PublicClient, type TransactionReceipt } from 'viem';
import type { BlockCache, StoredBlock } from './types.ts';
import { utils } from "@avalabs/avalanchejs";
// Define a type for the JSON-RPC request and response structures
interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params: any[];
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

import pLimit from 'p-limit';
import pThrottle from 'p-throttle';

class RpcMetrics {
    private metrics: {
        requestTime: number[]
        requestsInBatch: number[]
    }

    constructor() {
        this.metrics = {
            requestTime: [],
            requestsInBatch: []
        }

        const intervalSec = 5;

        setInterval(() => {
            const requestCount = this.metrics.requestTime.length;
            const minTime = Math.min(...this.metrics.requestTime);
            const maxTime = Math.max(...this.metrics.requestTime);
            const averageRequestTime = this.metrics.requestTime.reduce((sum, time) => sum + time, 0) / requestCount;
            const rps = requestCount / intervalSec;
            const avgRequestsInBatch = this.metrics.requestsInBatch.reduce((sum, requests) => sum + requests, 0) / this.metrics.requestsInBatch.length;

            console.log(`⏳ RPC Stats (${intervalSec}s): ${rps.toFixed(1)} rps, ${minTime}ms min, ${maxTime}ms max, ${averageRequestTime.toFixed(1)}ms avg, ${avgRequestsInBatch.toFixed(1)} avg requests in batch`);
            this.metrics.requestTime = [];
            this.metrics.requestsInBatch = [];
        }, intervalSec * 1000);
    }

    public recordRequestTime(time: number, requestsInBatch: number) {
        this.metrics.requestTime.push(time);
        this.metrics.requestsInBatch.push(requestsInBatch);
    }
}

export class BatchRpc {
    private concurencyLimiter: ReturnType<typeof pLimit>;
    private requestThrottle: ReturnType<typeof pThrottle>;

    private rpcUrl: string;
    private cache: BlockCache;
    private maxBatchSize: number;
    private metrics: RpcMetrics = new RpcMetrics();

    constructor({
        rpcUrl,
        cache,
        maxBatchSize = 25,
        maxConcurrency = 10,
        rps = 10
    }: {
        rpcUrl: string;
        cache: BlockCache;
        maxBatchSize?: number;
        maxConcurrency?: number;
        rps?: number;
    }) {
        if (!rpcUrl) {
            throw new Error('RPC_URL is not set or empty');
        }
        if (maxBatchSize <= 0) {
            throw new Error('maxBatchSize must be positive');
        }

        this.rpcUrl = rpcUrl;
        this.cache = cache;
        this.maxBatchSize = maxBatchSize;
        this.concurencyLimiter = pLimit(maxConcurrency);
        this.requestThrottle = pThrottle({
            limit: rps,
            interval: 1000
        });
    }

    /**
     * Sends a single pre-formed batch of JSON-RPC operations.
     * This is a private helper, and its execution (the fetch call) is wrapped by throttle and limiters by the caller.
     * Operations within this batch share a single HTTP request.
     * @param operations Array of operations for THIS batch, with internalId for correlation.
     */
    private async sendSingleJsonRpcBatch<T = any>(
        operations: Array<{ method: string; params: any[]; internalId: number | string }>
    ): Promise<Array<{ internalId: number | string; result?: T; error?: any }>> {
        const jsonRpcRequests: JsonRpcRequest[] = operations.map(({ method, params }, index) => ({
            jsonrpc: "2.0",
            id: index, // Batch-local ID, 0 to N-1 for this batch
            method,
            params
        }));

        const executeFetch = async () => {
            const startTime = Date.now();

            try {
                const httpResponse = await fetch(this.rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonRpcRequests)
                });

                if (!httpResponse.ok) {
                    const errorText = await httpResponse.text().catch(() => "Failed to get error text");
                    throw new Error(`RPC batch request failed to ${this.rpcUrl} with status ${httpResponse.status}: ${errorText}`);
                }
                // Server might return single response for single-item batch, or if batch request itself is an error.
                const jsonData = await httpResponse.json();
                return jsonData as unknown as JsonRpcResponse[] | JsonRpcResponse;
            } finally {
                this.metrics.recordRequestTime(Date.now() - startTime, jsonRpcRequests.length);
            }
        };

        try {
            // Apply throttle and concurrency limit to the actual fetch execution
            const responses = await this.requestThrottle(() => this.concurencyLimiter(executeFetch))();

            let individualResponses: JsonRpcResponse[];
            if (Array.isArray(responses)) {
                individualResponses = responses;
            } else if (responses && typeof responses === 'object' && 'jsonrpc' in responses) {
                // Handle cases where server returns a single response object (e.g. for a single item batch, or a batch-level error response)
                individualResponses = [responses as JsonRpcResponse];
            } else {
                throw new Error('Batch RPC response from server is not a valid JSON-RPC response or array of responses.');
            }

            const resultsMap = new Map<number, JsonRpcResponse>();
            individualResponses.forEach(response => {
                // Ensure ID is a number for map key / array index consistency.
                // JSON-RPC spec says ID can be string, number, or null.
                // Our batch-local IDs are always numbers (array indices).
                if (typeof response.id === 'number') {
                    resultsMap.set(response.id, response);
                } else {
                    // This might happen if the server returns an error for the batch itself without an ID, or with a non-numeric ID.
                    // If the batch had one item and its ID was non-numeric, this also needs care.
                    // For robustly mapping, if only one response and one op, can assume they match.
                    if (operations.length === 1 && individualResponses.length === 1) {
                        // Assume this single response corresponds to the single operation's batch-local id (0)
                        resultsMap.set(0, response);
                    } else {
                        console.error('RPC response item received with non-numeric or missing ID, cannot reliably map:', response);
                    }
                }
            });

            const results = operations.map((op, index) => { // index is the batch-local index (0..N-1)
                const responseForOp = resultsMap.get(index);
                if (responseForOp) {
                    return {
                        internalId: op.internalId, // This is the original overall ID (e.g. original_index)
                        result: responseForOp.result as T,
                        error: responseForOp.error
                    };
                }
                return {
                    internalId: op.internalId,
                    error: new Error(`No response for operation (method: ${op.method}, params: ${JSON.stringify(op.params)}) in batch. Batch-local index: ${index}.`)
                };
            });

            // console.log('Done a request with', results.length, 'results')
            return results

        } catch (batchLevelError) {
            return operations.map(op => ({
                internalId: op.internalId,
                error: batchLevelError
            }));
        }
    }

    /**
     * Takes a list of logical RPC requests, splits them into batches according to `maxBatchSize`,
     * executes these batches in parallel (respecting concurrency/throttle limits via `sendSingleJsonRpcBatch`),
     * and returns the aggregated results in the original order.
     * This replaces the original `batchRequest` stub and its TODO.
     */
    public async batchRpcRequests<T = any>(
        requests: Array<{ method: string; params: any[]; idToCorrelate?: any }>
    ): Promise<Array<{ idToCorrelate?: any; result?: T; error?: any }>> {
        if (!requests || requests.length === 0) {
            return [];
        }

        const indexedRequests = requests.map((req, index) => ({
            method: req.method,
            params: req.params,
            idToCorrelate: req.idToCorrelate,
            internalSequentialId: index // Original index for re-ordering
        }));

        const operationChunks: Array<Array<typeof indexedRequests[0]>> = [];
        for (let i = 0; i < indexedRequests.length; i += this.maxBatchSize) {
            operationChunks.push(indexedRequests.slice(i, i + this.maxBatchSize));
        }

        const batchExecutionPromises = operationChunks.map(chunk =>
            this.sendSingleJsonRpcBatch<T>(
                chunk.map(opInChunk => ({ // Map to structure expected by sendSingleJsonRpcBatch
                    method: opInChunk.method,
                    params: opInChunk.params,
                    internalId: opInChunk.internalSequentialId // Pass original index as internalId
                }))
            )
        );

        const resultsFromAllHttpBatches = await Promise.all(batchExecutionPromises);

        const finalResults = new Array(requests.length);
        resultsFromAllHttpBatches.forEach(batchResultArray => {
            batchResultArray.forEach(singleOpResult => {
                const originalRequestIndex = singleOpResult.internalId as number;
                if (originalRequestIndex !== undefined && originalRequestIndex < requests.length) {
                    finalResults[originalRequestIndex] = {
                        idToCorrelate: requests[originalRequestIndex].idToCorrelate,
                        result: singleOpResult.result,
                        error: singleOpResult.error
                    };
                } else {
                    console.error("Error mapping result back: internalId missing or out of bounds", singleOpResult);
                }
            });
        });

        // Check for any errors in the results and throw if found
        for (const result of finalResults) {
            if (result && result.error) {
                // Throw the first error encountered
                // It might be useful to aggregate errors or provide more context,
                // but for now, throwing the first error directly.
                throw result.error;
            }
        }
        return finalResults;
    }

    public async getBlocksWithReceipts(blockNumbers: number[]): Promise<StoredBlock[]> {
        if (!blockNumbers || blockNumbers.length === 0) {
            return [];
        }

        const results: Array<StoredBlock | null> = new Array(blockNumbers.length).fill(null);
        const cacheMisses: Array<{ originalIndex: number; blockNumber: number }> = [];

        // Step 1: Try to load from cache
        await Promise.all(blockNumbers.map(async (blockNumber, index) => {
            const cachedBlock = await this.cache.loadBlock(blockNumber);
            if (cachedBlock) {
                results[index] = cachedBlock;
            } else {
                cacheMisses.push({ originalIndex: index, blockNumber });
            }
        }));

        const numCached = blockNumbers.length - cacheMisses.length;
        const numUncached = cacheMisses.length;
        console.log(`getBlocksWithReceipts: Cache hits: ${numCached}, Cache misses (to fetch): ${numUncached}`);

        // Step 2: Fetch uncached blocks if any
        if (cacheMisses.length > 0) {
            const blockNumbersToFetch = cacheMisses.map(miss => miss.blockNumber);
            const fetchedBlocks = await this.getBlocksWithReceiptsUncached(blockNumbersToFetch);

            // Step 3: Save newly fetched blocks to cache and populate results
            const savePromises: Promise<void>[] = [];
            fetchedBlocks.forEach(fetchedBlock => {
                // Find the original index for this fetched block
                const missInfo = cacheMisses.find(miss => miss.blockNumber === Number(fetchedBlock.block.number));
                if (missInfo) {
                    results[missInfo.originalIndex] = fetchedBlock;
                    savePromises.push(this.cache.saveBlock(missInfo.blockNumber, fetchedBlock));
                } else {
                    // This case should ideally not happen if getBlocksWithReceiptsUncached returns blocks for all requested numbers
                    // or if block numbers are unique in the input.
                    console.warn(`Fetched block ${fetchedBlock.block.number} but could not find its original request index.`);
                }
            });
            await Promise.all(savePromises);
        }

        // Filter out any nulls which means a block was neither in cache nor fetched (shouldn't happen if fetch is robust)
        // And ensure the order is preserved.
        const finalResults = results.filter(block => block !== null) as StoredBlock[];

        // The `finalResults` might not be in the same order as `blockNumbers` if some blocks failed to load/fetch.
        // We need to re-order based on the original `blockNumbers` array.
        // However, `results` array is already in the correct order due to indexed assignment.
        // The filtering step above might remove elements, so we need a more robust way to map back if order is critical
        // and not all blocks are guaranteed to be found.

        // For now, assuming `results` will be dense if all blocks are found, or sparse with nulls.
        // If a block is truly missing (not in cache, failed to fetch), it will be null in results.
        // The requirement is to return StoredBlock[], so we must filter out nulls.
        // This means the returned array length might be less than blockNumbers.length if blocks are missing.

        // To ensure the output array corresponds to the input `blockNumbers` and maintains order,
        // while also considering that some blocks might be completely unresolvable (neither in cache nor fetchable),
        // we will reconstruct the result carefully.

        const orderedResults: StoredBlock[] = [];
        const fetchedMap = new Map<number, StoredBlock>();
        finalResults.forEach(block => {
            if (block && block.block && typeof block.block.number === 'bigint') { // viem returns bigint for block.number
                fetchedMap.set(Number(block.block.number), block);
            } else if (block && block.block && typeof block.block.number === 'string') { // sometimes it's a hex string from RPC
                fetchedMap.set(parseInt(block.block.number, 16), block);
            } else if (block && block.block && typeof block.block.number === 'number') { // or just a number
                fetchedMap.set(block.block.number, block);
            }

        });

        blockNumbers.forEach(num => {
            const block = fetchedMap.get(num);
            if (block) {
                orderedResults.push(block);
            }
            // If block is not in fetchedMap, it means it was not found in cache and could not be fetched.
            // It will be omitted from the result as per StoredBlock[] promise.
        });
        return orderedResults;
    }

    /**
     * Fetches multiple blocks and their transaction receipts using batched RPC calls.
     * Implements the `getBlocksWithReceipts` TODO.
     */
    public async getBlocksWithReceiptsUncached(blockNumbers: number[]): Promise<StoredBlock[]> {
        if (!blockNumbers || blockNumbers.length === 0) {
            return [];
        }

        // Stage 1: Fetch all blocks
        const blockOperations = blockNumbers.map((num, index) => ({
            method: 'eth_getBlockByNumber',
            params: [`0x${num.toString(16)}`, true], // true for includeTransactions
            idToCorrelate: { type: 'block_fetch', blockNumber: num, originalBlockIndex: index }
        }));

        const blockResponses = await this.batchRpcRequests<GetBlockReturnType<Chain, true, 'latest'>>(blockOperations);

        const successfullyFetchedBlocksMap = new Map<number, GetBlockReturnType<Chain, true, 'latest'>>();
        const receiptOperations: Array<{ method: string; params: [`0x${string}`]; idToCorrelate: { type: 'receipt_fetch', originalBlockIndex: number; txHash: `0x${string}` } }> = [];

        blockResponses.forEach(response => {
            const correlationData = response.idToCorrelate as { type: 'block_fetch', blockNumber: number, originalBlockIndex: number };
            if (response.error || !response.result) {
                console.warn(`Failed to fetch block ${correlationData.blockNumber} (original index ${correlationData.originalBlockIndex}):`, response.error || 'No result');
                return;
            }

            const block = response.result;
            successfullyFetchedBlocksMap.set(correlationData.originalBlockIndex, block);

            if (block.transactions && Array.isArray(block.transactions)) {
                block.transactions.forEach(tx => {
                    let txHash: `0x${string}` | undefined;
                    if (typeof tx === 'string') {
                        txHash = tx;
                    } else if (tx && typeof tx === 'object' && tx.hash && typeof tx.hash === 'string') {
                        txHash = tx.hash as `0x${string}`;
                    }

                    if (txHash) {
                        receiptOperations.push({
                            method: 'eth_getTransactionReceipt',
                            params: [txHash],
                            idToCorrelate: {
                                type: 'receipt_fetch',
                                originalBlockIndex: correlationData.originalBlockIndex,
                                txHash
                            }
                        });
                    } else {
                        console.warn(`Transaction in block ${correlationData.blockNumber} (original index ${correlationData.originalBlockIndex}) has an unexpected format or no hash:`, tx);
                    }
                });
            }
        });

        // Stage 2: Fetch receipts for transactions from successfully fetched blocks
        const receiptResponses = receiptOperations.length > 0
            ? await this.batchRpcRequests<TransactionReceipt>(receiptOperations)
            : [];

        // Stage 3: Assemble StoredBlock results, ensuring order and handling missing blocks
        const storedBlocksResult: StoredBlock[] = [];
        for (let i = 0; i < blockNumbers.length; i++) {
            const blockData = successfullyFetchedBlocksMap.get(i);
            if (blockData) { // Only proceed if this block was successfully fetched
                const currentStoredBlock: StoredBlock = {
                    block: blockData,
                    receipts: {}
                };
                // Populate receipts for this block
                receiptResponses.forEach(receiptResponse => {
                    const receiptCorrelation = receiptResponse.idToCorrelate as { type: 'receipt_fetch', originalBlockIndex: number; txHash: `0x${string}` };
                    if (receiptCorrelation.originalBlockIndex === i) { // Match receipts to the current block being assembled
                        if (receiptResponse.result && !receiptResponse.error) {
                            currentStoredBlock.receipts[receiptCorrelation.txHash] = receiptResponse.result;
                        } else {
                            console.warn(`Failed to fetch receipt for tx ${receiptCorrelation.txHash} in block (original index ${i}):`, receiptResponse.error || 'No result');
                        }
                    }
                });
                storedBlocksResult.push(currentStoredBlock);
            }
            // If blockData for index 'i' is undefined, that block fetch failed and it's omitted from the final results.
            // This means the output array may be shorter than blockNumbers if some blocks couldn't be fetched.
        }
        return storedBlocksResult;
    }

    public getCurrentBlockNumber(): Promise<number> {
        return this.batchRpcRequests<string>([{ method: 'eth_blockNumber', params: [] }]).then(results => {
            if (results && results.length > 0 && results[0].result && !results[0].error) {
                return parseInt(results[0].result, 16);
            }
            throw new Error('Failed to get current block number');
        });
    }
}

/**
 * Fetches the Avalanche Blockchain ID by calling the getBlockchainID() method on the Warp precompile.
 * This function makes a direct JSON-RPC 'eth_call' to the given RPC endpoint.
 * @param rpcUrl The URL of the JSON-RPC endpoint.
 * @returns A promise that resolves to the base58check encoded Avalanche Blockchain ID.
 */
export async function fetchBlockchainIDFromPrecompile(rpcUrl: string): Promise<string> {
    const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005' as const;
    const getBlockchainIDFunctionSignature = '0x4213cf78'; // Function signature for getBlockchainID()

    const requestPayload: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1, // Static ID for this single request
        method: "eth_call",
        params: [{
            to: WARP_PRECOMPILE_ADDRESS,
            data: getBlockchainIDFunctionSignature
        }, "latest"]
    };

    const httpResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
    });

    if (!httpResponse.ok) {
        const errorText = await httpResponse.text().catch(() => "Failed to get error text");
        throw new Error(`RPC request to fetch blockchain ID failed at ${rpcUrl} with status ${httpResponse.status}: ${errorText}`);
    }

    const responseJson = await httpResponse.json() as JsonRpcResponse;

    if (responseJson.error) {
        throw new Error(`RPC error fetching blockchain ID: ${responseJson.error.message} (Code: ${responseJson.error.code})`);
    }

    if (typeof responseJson.result !== 'string' || !responseJson.result.startsWith('0x')) {
        throw new Error('Invalid result format for blockchain ID from precompile.');
    }

    const blockchainIDHex = responseJson.result;
    const chainIdBytes = utils.hexToBuffer(blockchainIDHex);
    const avalancheChainId = utils.base58check.encode(chainIdBytes);

    return avalancheChainId;
}
