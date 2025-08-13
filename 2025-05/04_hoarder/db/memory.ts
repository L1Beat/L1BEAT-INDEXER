import type { HoarderDB, StoredBlock } from "./types";

export class MemoryDB implements HoarderDB {
    private blocks: Map<number, StoredBlock> = new Map();

    async storeBlock(blockNumber: number, block: StoredBlock): Promise<void> {
        console.log(`Storing block ${blockNumber}`);
        this.blocks.set(blockNumber, block);
    }

    async getBlock(blockNumber: number): Promise<StoredBlock | undefined> {
        return this.blocks.get(blockNumber);
    }

    async getLastStoredBlockNumber(): Promise<number> {
        if (this.blocks.size === 0) {
            throw new Error('No blocks stored');
        }
        return Math.max(...this.blocks.keys());
    }
}
