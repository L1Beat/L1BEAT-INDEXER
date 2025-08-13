import type { Chain } from "viem";
import type { GetBlockReturnType } from "viem";

export interface BlockCache {
    saveBlock(blockNumber: number, block: StoredBlock): Promise<void>;
    loadBlock(blockNumber: number): Promise<StoredBlock | null>;
}

export type StoredBlock = {
    block: GetBlockReturnType<Chain, true, 'latest'>;
    receipts: Record<string, any>;
}
