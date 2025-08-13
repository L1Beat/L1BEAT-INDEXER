import { utils } from "@avalabs/avalanchejs";
import PQueue from 'p-queue';
import type * as EVMTypes from '../evmTypes';
import { DynamicBatchSizeManager } from './DynamicBatchSizeManager';

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

export interface StoredBlock {
    block: EVMTypes.Block;
    receipts: Record<string, EVMTypes.Receipt>;
}

export class BatchRpc {
    private rpcUrl: string;
    private queue: PQueue;
    private batchSize: number;
    private dynamicBatchSizeManager: DynamicBatchSizeManager | null;
    private enableBatchSizeGrowth: boolean;

    constructor({
        rpcUrl,
        batchSize,
        maxConcurrent,
        rps,
        enableBatchSizeGrowth = false,
    }: {
        rpcUrl: string;
        batchSize: number;
        maxConcurrent: number;
        rps: number;
        enableBatchSizeGrowth?: boolean;
    }) {
        if (!rpcUrl) {
            throw new Error('RPC_URL is not set or empty');
        }

        this.rpcUrl = rpcUrl;
        this.queue = new PQueue({
            concurrency: maxConcurrent,
            interval: 1000, // 1 second
            intervalCap: rps
        });
        this.batchSize = batchSize;
        this.enableBatchSizeGrowth = enableBatchSizeGrowth;
        this.dynamicBatchSizeManager = enableBatchSizeGrowth ? new DynamicBatchSizeManager(batchSize) : null;
    }

    /**
     * Makes an HTTP request using Node.js built-in fetch with automatic compression handling
     */
    private async makeHttpRequest(body: string): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            body
        });

        return {
            ok: response.ok,
            status: response.status,
            json: () => response.json(),
            text: () => response.text()
        };
    }

    /**
     * Sends a single JSON-RPC batch request
     */
    private async sendBatch<T = any>(
        requests: Array<{ method: string; params: any[]; originalIndex: number }>
    ): Promise<Array<{ originalIndex: number; result?: T; error?: any }>> {
        return await this.queue.add(async () => {
            try {
                // Create JSON-RPC batch request
                const jsonRpcRequests: JsonRpcRequest[] = requests.map((req, batchIndex) => ({
                    jsonrpc: "2.0",
                    id: batchIndex, // Local batch ID
                    method: req.method,
                    params: req.params
                }));

                const response = await this.makeHttpRequest(JSON.stringify(jsonRpcRequests));

                if (!response.ok) {
                    this.dynamicBatchSizeManager?.onError();
                    throw new Error(`RPC batch request failed to ${this.rpcUrl} with status ${response.status}: ${await response.text().catch(() => "Failed to get error text")}`);
                }

                const jsonData = await response.json();

                // Handle both single response and array of responses
                let responses: JsonRpcResponse[];
                if (Array.isArray(jsonData)) {
                    responses = jsonData;
                } else if (jsonData && typeof jsonData === 'object' && 'jsonrpc' in jsonData) {
                    responses = [jsonData as JsonRpcResponse];
                } else {
                    this.dynamicBatchSizeManager?.onError();
                    throw new Error('Invalid JSON-RPC batch response format');
                }

                // Map responses back to original indices
                const responseMap = new Map<number, JsonRpcResponse>();
                responses.forEach(resp => {
                    if (typeof resp.id === 'number') {
                        responseMap.set(resp.id, resp);
                    }
                });

                const results = requests.map((req, batchIndex) => {
                    const resp = responseMap.get(batchIndex);
                    return {
                        originalIndex: req.originalIndex,
                        result: resp?.result as T,
                        error: resp?.error
                    };
                });

                // Check if any individual requests failed
                const hasErrors = results.some(result => result.error);
                if (hasErrors) {
                    this.dynamicBatchSizeManager?.onError();
                } else {
                    this.dynamicBatchSizeManager?.onSuccess();
                }

                return results;
            } catch (error) {
                this.dynamicBatchSizeManager?.onError();
                throw error;
            }
        }, { throwOnTimeout: true })
    }

    /**
     * Executes multiple RPC requests using JSON-RPC batching
     */
    public async batchRpcRequests<T = any>(
        requests: Array<{ method: string; params: any[]; idToCorrelate?: any }>
    ): Promise<Array<{ idToCorrelate?: any; result?: T; error?: any }>> {
        if (!requests || requests.length === 0) {
            return [];
        }

        // Add original indices to track request order
        const indexedRequests = requests.map((req, index) => ({
            method: req.method,
            params: req.params,
            originalIndex: index,
            idToCorrelate: req.idToCorrelate
        }));

        // Split into batches using either dynamic or fixed batch size
        const currentBatchSize = this.enableBatchSizeGrowth
            ? this.dynamicBatchSizeManager!.getCurrentBatchSize()
            : this.batchSize;

        const batches: Array<Array<typeof indexedRequests[0]>> = [];
        for (let i = 0; i < indexedRequests.length; i += currentBatchSize) {
            batches.push(indexedRequests.slice(i, i + currentBatchSize));
        }

        // Send all batches in parallel
        const batchPromises = batches.map(batch =>
            this.sendBatch<T>(batch.map(req => ({
                method: req.method,
                params: req.params,
                originalIndex: req.originalIndex
            })))
        );

        const batchResults = await Promise.all(batchPromises);

        // Flatten and reorder results
        const results = new Array<{ idToCorrelate?: any; result?: T; error?: any }>(requests.length);

        batchResults.forEach(batchResult => {
            batchResult.forEach(item => {
                const originalRequest = indexedRequests[item.originalIndex];
                results[item.originalIndex] = {
                    idToCorrelate: originalRequest.idToCorrelate,
                    result: item.result,
                    error: item.error
                };
            });
        });

        return results;
    }

    private async makeRpcCall<T = any>(method: string, params: any[]): Promise<T> {
        const results = await this.batchRpcRequests<T>([{ method, params }]);
        const firstResult = results[0];

        if (firstResult.error) {
            throw firstResult.error;
        }

        return firstResult.result!;
    }

    public async getCurrentBlockNumber(): Promise<number> {
        const result = await this.makeRpcCall<string>('eth_blockNumber', []);
        return parseInt(result, 16);
    }

    public async getEvmChainId(): Promise<number> {
        const result = await this.makeRpcCall<string>('eth_chainId', []);
        return parseInt(result, 16);
    }

    //TODO: implement priority queue pushing earlier blocks to the front of the queue
    public async getBlocksWithReceipts(blockNumbers: number[]): Promise<StoredBlock[]> {
        if (!blockNumbers || blockNumbers.length === 0) {
            return [];
        }

        // Stage 1: Fetch all blocks in batches
        const blockOperations = blockNumbers.map((num, index) => ({
            method: 'eth_getBlockByNumber',
            params: [`0x${num.toString(16)}`, true], // true for includeTransactions
            idToCorrelate: { type: 'block_fetch', blockNumber: num, originalBlockIndex: index }
        }));

        const blockResponses = await this.batchRpcRequests<EVMTypes.Block | null>(blockOperations);

        const successfullyFetchedBlocksMap = new Map<number, EVMTypes.Block>();
        const receiptOperations: Array<{ method: string; params: [string]; idToCorrelate: { type: 'receipt_fetch', originalBlockIndex: number; txHash: string } }> = [];

        // Process block responses and collect transaction hashes
        blockResponses.forEach(response => {
            const correlationData = response.idToCorrelate as { type: 'block_fetch', blockNumber: number, originalBlockIndex: number };
            if (response.error || !response.result) {
                console.warn(`Failed to fetch block ${correlationData.blockNumber} (original index ${correlationData.originalBlockIndex}):`, response.error || 'No result');
                return;
            }

            const block = response.result;
            successfullyFetchedBlocksMap.set(correlationData.originalBlockIndex, block);

            if (block.transactions && Array.isArray(block.transactions)) {
                block.transactions.forEach((tx: any) => {
                    let txHash: string | undefined;
                    if (typeof tx === 'string') {
                        txHash = tx;
                    } else if (tx && typeof tx === 'object' && tx.hash && typeof tx.hash === 'string') {
                        txHash = tx.hash;
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

        // Stage 2: Fetch all receipts in batches
        const receiptResponses = receiptOperations.length > 0
            ? await this.batchRpcRequests<EVMTypes.Receipt>(receiptOperations)
            : [];

        // Stage 3: Assemble StoredBlock results
        const storedBlocksResult: StoredBlock[] = [];
        for (let i = 0; i < blockNumbers.length; i++) {
            const blockData = successfullyFetchedBlocksMap.get(i);
            if (blockData) {
                const currentStoredBlock: StoredBlock = {
                    block: blockData,
                    receipts: {}
                };

                const expectedTxCount = blockData.transactions?.length || 0;
                let actualReceiptCount = 0;

                // Populate receipts for this block
                receiptResponses.forEach(receiptResponse => {
                    const receiptCorrelation = receiptResponse.idToCorrelate as { type: 'receipt_fetch', originalBlockIndex: number; txHash: string };
                    if (receiptCorrelation.originalBlockIndex === i) {
                        if (receiptResponse.result && !receiptResponse.error) {
                            currentStoredBlock.receipts[receiptCorrelation.txHash] = receiptResponse.result;
                            actualReceiptCount++;
                        } else {
                            throw new Error(`Failed to fetch receipt for tx ${receiptCorrelation.txHash} in block ${blockNumbers[i]}: ${receiptResponse.error?.message || 'No result'}`);
                        }
                    }
                });

                // Verify all receipts were fetched
                if (actualReceiptCount !== expectedTxCount) {
                    throw new Error(`Receipt count mismatch for block ${blockNumbers[i]}: expected ${expectedTxCount} receipts, got ${actualReceiptCount}`);
                }

                storedBlocksResult.push(currentStoredBlock);
            }
        }

        return storedBlocksResult;
    }

    public async fetchBlockchainIDFromPrecompile(): Promise<string> {
        const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005';
        const getBlockchainIDFunctionSignature = '0x4213cf78';

        const result = await this.makeRpcCall<string>('eth_call', [
            {
                to: WARP_PRECOMPILE_ADDRESS,
                data: getBlockchainIDFunctionSignature
            },
            "latest"
        ]);

        console.log('result', this.rpcUrl, result);

        if (typeof result !== 'string' || !result.startsWith('0x')) {
            throw new Error('Invalid result format for blockchain ID from precompile.');
        }

        const chainIdBytes = utils.hexToBuffer(result);
        const avalancheChainId = utils.base58check.encode(chainIdBytes);

        return avalancheChainId;
    }

    /**
     * Get dynamic batch size statistics for monitoring
     */
    public getBatchSizeStats(): { current: number; min: number; utilizationRatio: number } {
        if (!this.enableBatchSizeGrowth || !this.dynamicBatchSizeManager) {
            return {
                current: this.batchSize,
                min: this.batchSize,
                utilizationRatio: 1.0
            };
        }
        return this.dynamicBatchSizeManager.getStats();
    }
}
