import SQLite from 'better-sqlite3';
import { StoredBlock } from '../rpc/BatchRpc';
import { compress, decompress } from '../lib/compressor/compressor';
import { DEFAULT_PRAGMAS } from './pragmas';


const createSQL = `
PRAGMA page_size = 4096;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -64000;
PRAGMA wal_autocheckpoint = 10000;
PRAGMA checkpoint_fullfsync = OFF;

CREATE TABLE IF NOT EXISTS blocks (
	block_number INTEGER PRIMARY KEY,
	data BLOB NOT NULL
);
`

export class SqliteBlockStore {
    constructor(protected db: SQLite.Database) { }

    public initialize() {
        this.db.exec(DEFAULT_PRAGMAS)
        this.db.exec(createSQL)
        this.db.pragma('optimize')
    }

    private getBlocksCache: Map<string, { blocks: (StoredBlock | null)[], missingIndexes: number[], missingBlockNumbers: number[] }> = new Map();
    private getBlocksLocks: Map<string, Promise<void>> = new Map();

    public async getBlocks(blockNumbers: number[]): Promise<{ blocks: (StoredBlock | null)[], missingIndexes: number[], missingBlockNumbers: number[] }> {
        const cacheKey = blockNumbers.join(',');

        // Check if there's an existing lock for this cache key
        const existingLock = this.getBlocksLocks.get(cacheKey);
        if (existingLock) {
            await existingLock;
        }

        // Check cache
        const cached = this.getBlocksCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Create a new lock
        let resolveLock: () => void;
        const lock = new Promise<void>((resolve) => {
            resolveLock = resolve;
        });
        this.getBlocksLocks.set(cacheKey, lock);

        try {
            // Fetch the data
            const result = await this.getBlocksUncached(blockNumbers);

            // Store in cache
            this.getBlocksCache.set(cacheKey, result);

            // Set timeout to remove from cache after 10 seconds
            setTimeout(() => {
                this.getBlocksCache.delete(cacheKey);
            }, 10 * 1000);

            return result;
        } finally {
            // Release the lock
            resolveLock!();
            this.getBlocksLocks.delete(cacheKey);
        }
    }


    public async getBlocksUncached(blockNumbers: number[]): Promise<{ blocks: (StoredBlock | null)[], missingIndexes: number[], missingBlockNumbers: number[] }> {
        if (!blockNumbers || blockNumbers.length === 0) {
            return { blocks: [], missingIndexes: [], missingBlockNumbers: [] };
        }

        const result: (StoredBlock | null)[] = new Array(blockNumbers.length).fill(null);
        const missingBlockNumbers: number[] = [];
        const missingIndexes: number[] = [];

        // Fetch all cached blocks with a single query
        const placeholders = blockNumbers.map(() => '?').join(',');
        const selectQuery = `SELECT block_number, data FROM blocks WHERE block_number IN (${placeholders})`;
        const rows = this.db.prepare(selectQuery).all(...blockNumbers) as { block_number: number; data: Buffer }[];

        // Create a map for quick lookup
        const cachedBlocksMap = new Map<number, Buffer>();
        for (const row of rows) {
            cachedBlocksMap.set(row.block_number, row.data);
        }

        // Process each requested block
        for (let i = 0; i < blockNumbers.length; i++) {
            const blockNumber = blockNumbers[i];
            const cachedData = cachedBlocksMap.get(blockNumber);

            if (cachedData) {
                // Decompress and parse the stored block
                const storedBlock = await decompress<StoredBlock>(cachedData);

                // Validate block integrity
                const expectedTxCount = storedBlock.block.transactions?.length || 0;
                const actualReceiptCount = Object.keys(storedBlock.receipts).length;

                if (expectedTxCount !== actualReceiptCount) {
                    console.warn(`Corrupted block ${blockNumber} in database: expected ${expectedTxCount} receipts, got ${actualReceiptCount}. Deleting corrupted block. This is not normal, you should investigate.`);

                    // Delete the corrupted block from database
                    const deleteStmt = this.db.prepare('DELETE FROM blocks WHERE block_number = ?');
                    deleteStmt.run(blockNumber);

                    missingBlockNumbers.push(blockNumber);
                    missingIndexes.push(i);
                    continue;
                }

                result[i] = storedBlock;
            } else {
                missingBlockNumbers.push(blockNumber);
                missingIndexes.push(i);
            }
        }

        return { blocks: result, missingIndexes, missingBlockNumbers };
    }

    public async storeBlocks(blocks: StoredBlock[]) {
        const insertQuery = `INSERT INTO blocks (block_number, data) VALUES (?, ?)`;
        const insertStatement = this.db.prepare(insertQuery);
        for (const block of blocks) {
            const compressedData = await compress(block);
            insertStatement.run(parseInt(block.block.number, 16), compressedData);
        }
    }

    public async getBlock(blockNumber: number): Promise<StoredBlock | null> {
        const blocks = await this.getBlocks([blockNumber]);
        return blocks.blocks[0] ?? null;
    }
}
