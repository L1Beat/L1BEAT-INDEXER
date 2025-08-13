import type { Chain } from "viem";
import type { GetBlockReturnType } from "viem";

export interface HoarderDB {
    storeBlock(blockNumber: number, block: StoredBlock): Promise<void>;
    getLastStoredBlockNumber(): Promise<number>;
}

export type StoredBlock = {
    block: GetBlockReturnType<Chain, true, 'latest'>;
    receipts: Record<string, any>;
}
