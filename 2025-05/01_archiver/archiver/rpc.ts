import { createPublicClient, http, type PublicClient, type Block, type TransactionReceipt } from 'viem';
import { mainnet } from 'viem/chains';

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

export class RPC {
    private batchQueue: {
        method: string;
        params: any[];
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }[] = [];
    private intervalId: NodeJS.Timeout | null = null;
    private chainIdCache: number | null = null;
    private isProcessingBatch = false;

    constructor(
        private rpcUrl: string,
        private maxBatchSize: number = 25,
        private batchInterval: number = 50
    ) {
        if (!rpcUrl) {
            throw new Error('RPC_URL is not set');
        }

        // Start the interval for regular batch processing
        this.intervalId = setInterval(() => this.processBatch(), this.batchInterval);
    }

    public async loadChainId(): Promise<void> {
        if (this.chainIdCache === null) {
            this.chainIdCache = await this.getChainId();
        }
    }

    public getCachedChainId(): number | null {
        return this.chainIdCache;
    }

    private request<T>(method: string, params: any[] = []): Promise<T> {
        return new Promise((resolve, reject) => {
            this.batchQueue.push({ method, params, resolve, reject });
        });
    }

    private async processBatch() {
        // Don't run concurrent batch processing
        if (this.isProcessingBatch || this.batchQueue.length === 0) return;

        this.isProcessingBatch = true;

        try {
            // Take at most maxBatchSize items from the queue, maintaining FIFO order
            const batchToProcess = this.batchQueue.splice(0, this.maxBatchSize);

            const batchRequests: JsonRpcRequest[] = batchToProcess.map(({ method, params }, index) => ({
                jsonrpc: "2.0",
                id: index,
                method,
                params
            }));

            try {
                // Perform the fetch directly - we're already timing batches
                const httpResponse = await fetch(this.rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batchRequests)
                });

                if (!httpResponse.ok) {
                    const errorText = await httpResponse.text();
                    throw new Error(`RPC request failed with status ${httpResponse.status}: ${errorText}`);
                }

                const responses = await httpResponse.json() as JsonRpcResponse[];

                if (!Array.isArray(responses)) {
                    throw new Error('Batch RPC response is not an array');
                }

                responses.forEach((response) => {
                    const requestItem = batchToProcess[response.id];
                    if (requestItem) {
                        if (response.error) {
                            requestItem.reject(response.error);
                        } else {
                            requestItem.resolve(response.result);
                        }
                    } else {
                        console.error(`Received response for unknown ID: ${response.id}`);
                    }
                });
            } catch (error) {
                batchToProcess.forEach(item => item.reject(error));
            }
        } finally {
            this.isProcessingBatch = false;
        }
    }

    // Cleanup method to cancel the interval when done
    public dispose() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public async fetchBlockAndReceipts(blockNumber: number): Promise<{
        block: Block<bigint, true>;
        receipts: Record<string, TransactionReceipt>;
    }> {
        const block = await this.getBlock(BigInt(blockNumber), true);

        const receiptPromises = block.transactions.map(tx => {
            const txHash = typeof tx === 'string' ? tx : (tx as { hash: `0x${string}` }).hash;
            return this.getTransactionReceipt(txHash as `0x${string}`)
                .then(receipt => [txHash, receipt] as const);
        });

        const receiptEntries = await Promise.all(receiptPromises);
        const receipts = Object.fromEntries(receiptEntries) as Record<string, TransactionReceipt>;


        if (Object.keys(receipts).length !== block.transactions.length) {
            console.log('block', block);
            console.log('receipts', receipts);
            process.exit(1);
        }

        return { block, receipts };
    }

    public getCurrentBlockNumber(): Promise<bigint> {
        return this.request<string>('eth_blockNumber').then(hex => BigInt(hex));
    }

    public getChainId(): Promise<number> {
        return this.request<string>('eth_chainId').then(hex => parseInt(hex, 16));
    }

    public getBlock(blockNumberOrTag: bigint | 'latest' | 'earliest' | 'pending', includeTransactions: boolean = true): Promise<Block<bigint, typeof includeTransactions>> {
        const paramBlock = typeof blockNumberOrTag === 'bigint' ? `0x${blockNumberOrTag.toString(16)}` : blockNumberOrTag;
        return this.request<Block<bigint, typeof includeTransactions>>('eth_getBlockByNumber', [paramBlock, includeTransactions]);
    }

    public getTransactionReceipt(txHash: `0x${string}`): Promise<TransactionReceipt> {
        return this.request<TransactionReceipt>('eth_getTransactionReceipt', [txHash]);
    }
}
