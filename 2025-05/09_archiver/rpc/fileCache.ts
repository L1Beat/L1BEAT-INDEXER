import type { BlockCache, StoredBlock } from "./types.ts";
import { compress, decompress } from "./compressor.ts";
import { encode } from "cbor2";
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export class FileBlockStore implements BlockCache {
    constructor(private cacheDir: string) {
        fsSync.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Convert block number to file path using simple padding
    private getPathFromBlockNumber(blockNumber: number): string {
        return path.join(this.cacheDir, `${blockNumber.toString().padStart(12, '0')}.json.zstd`);
    }


    async saveBlock(blockNumber: number, block: StoredBlock): Promise<void> {
        const originalSize = Buffer.from(encode(block)).length;
        const compressionStarted = performance.now();
        const data = await compress(block);
        const compressedSize = data.length;
        const txCount = block.block.transactions.length;
        const compressionTime = performance.now() - compressionStarted;

        // console.log(`🚃 Block ${blockNumber}: ${txCount} txs, ${(originalSize / 1024).toFixed(2)}KB -> ${(compressedSize / 1024).toFixed(2)}KB (${(originalSize / compressedSize).toFixed(1)}x reduction, ${compressionTime.toFixed(2)}ms compression time)`);

        const filePath = this.getPathFromBlockNumber(blockNumber);
        await fs.writeFile(filePath, data);
    }

    async loadBlock(blockNumber: number): Promise<StoredBlock | null> {
        const filePath = this.getPathFromBlockNumber(blockNumber);

        try {
            const data = await fs.readFile(filePath);
            if (data.length === 0) {
                return null;
            }
            return decompress(data) as Promise<StoredBlock>;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error; // Re-throw other errors
        }
    }
}
