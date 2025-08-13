import { RPC } from "./rpc";
import type { HoarderDB, StoredBlock } from "../db/types";

export class Hoarder {
    private pendingBlocks: Map<number, StoredBlock> = new Map();
    private nextBlockToStore: number = 0;

    constructor(private db: HoarderDB, private rpc: RPC, private maxConcurrency: number = 100) {

    }

    private async processPendingBlocks() {
        while (this.pendingBlocks.has(this.nextBlockToStore)) {
            const timerName = `processPendingBlocks${this.nextBlockToStore}`;
            console.time(timerName);
            const block = this.pendingBlocks.get(this.nextBlockToStore)!;
            await this.db.storeBlock(this.nextBlockToStore, block);
            this.pendingBlocks.delete(this.nextBlockToStore);
            this.nextBlockToStore++;
            console.log(`Stored block ${this.nextBlockToStore - 1}`);
            console.timeEnd(timerName);
        }
    }

    async startLoop() {
        let lastBlockOnChain = await this.rpc.getCurrentBlockNumber();

        let lastScannedBlock = -1;
        try {
            lastScannedBlock = await this.db.getLastStoredBlockNumber();
            console.log(`Last scanned block: ${lastScannedBlock}`);
            this.nextBlockToStore = lastScannedBlock + 1;
        } catch (e) {
            console.warn('No last scanned block found, starting from 0');
            this.nextBlockToStore = 0;
        }

        let activePromises = 0;
        while (lastBlockOnChain >= lastScannedBlock) {
            // Wait if we've reached our concurrency limit
            if (activePromises >= this.maxConcurrency) {
                await this.processPendingBlocks();
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            if (lastBlockOnChain === lastScannedBlock) {
                lastBlockOnChain = await this.rpc.getCurrentBlockNumber();
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const blockNumber = ++lastScannedBlock;
            activePromises++;

            retryWithBackOff(async () => {
                const block = await this.rpc.fetchBlockAndReceipts(Number(blockNumber));
                this.pendingBlocks.set(blockNumber, block);
                console.log(`Fetched block ${blockNumber}`);
            }, 20).catch(error => {
                console.error(`Error processing block ${blockNumber}:`, error);
                process.exit(1);//FIXME: implement onError or something, at least retry
            }).finally(() => {
                activePromises--;
            });
        }
    }
}

async function retryWithBackOff(fn: () => Promise<void>, retries: number = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await fn();
            return;
        } catch (error) {
            console.error(`Error in retry: ${error}`);
            if (i === retries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
