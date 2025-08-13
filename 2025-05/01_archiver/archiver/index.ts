import { RPC } from "./rpc";
import { ArchiverDB } from "./db";
import { LastProcessed } from "./lastProcessed";
import { incrementAddedThisSecond } from "./stats";
import type { GetBlockReturnType } from "viem";
const MAX_CONCURRENCY = 100;

type StoredBlock = {
    block: GetBlockReturnType<undefined, true, 'latest'>;
    receipts: Record<string, any>;
}

export class Archiver {
    private lastBlockNumber: number = -1;


    constructor(private db: ArchiverDB, private rpc: RPC) {
    }

    async subscribe(callback: (block: StoredBlock) => Promise<void>, startFromBlock: number) {
        let currentBlock = startFromBlock;
        while (true) {
            if (currentBlock <= this.lastBlockNumber) {
                const blocks = await this.db.load<StoredBlock>('block-' + currentBlock.toString());
                await callback(blocks);
                currentBlock++;
            } else {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    async startLoop() {
        const lastProcessed = new LastProcessed();
        let lastBlockOnChain = await this.rpc.getCurrentBlockNumber();

        let lastScannedBlock = -1n;
        try {
            lastScannedBlock = await this.db.load<bigint>('lastScannedBlock');
            console.log(`Last scanned block: ${lastScannedBlock}`);
        } catch (e) {
            console.warn('No last scanned block found, starting from 0');
        }

        lastProcessed.setLastProcessed(Number(lastScannedBlock));

        lastProcessed.onIncremented(async (lastProcessed) => {
            lastProcessed % 100 === 0 && console.log(`Last processed block: ${lastProcessed}`);
            await this.db.save('lastScannedBlock', lastProcessed);
            this.lastBlockNumber = lastProcessed;
        });

        let activePromises = 0;
        while (lastBlockOnChain >= lastScannedBlock) {
            // Wait if we've reached our concurrency limit
            if (activePromises >= MAX_CONCURRENCY) {
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

            this.rpc.fetchBlockAndReceipts(Number(blockNumber)).then(async (block) => {
                await this.db.save('block-' + blockNumber.toString(), block);
                incrementAddedThisSecond();
                lastProcessed.reportProcessed(Number(blockNumber));
            }).catch(error => {
                console.error(`Error processing block ${blockNumber}:`, error);
                process.exit(1);//FIXME: implement onError or something, at least retry
            }).finally(() => {
                activePromises--;
            });
        }
    }
}
