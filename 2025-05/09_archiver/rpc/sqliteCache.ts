import type { BlockCache, StoredBlock } from "./types.ts";
import { compress, decompress } from "./compressor.ts";
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

interface PendingWrite {
    blockNumber: number;
    data: Buffer;
}

export class SqliteBlockStore implements BlockCache {
    private db: Database.Database;
    private writeBuffer: PendingWrite[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL_MS = 100; // 2 seconds
    private readonly BUFFER_SIZE = 100; // Flush after 100 blocks
    private insertStmt: Database.Statement;

    constructor(private dbPath: string) {
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        fs.mkdirSync(dir, { recursive: true });

        // Initialize database with all optimizations and schema
        this.db = new Database(this.dbPath);
        this.db.exec(`
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
        `);

        // Prepare the insert statement once
        this.insertStmt = this.db.prepare(`
            INSERT OR REPLACE INTO blocks (block_number, data) VALUES (?, ?)
        `);
    }

    private scheduleFlush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }

        this.flushTimer = setTimeout(() => {
            this.flushWrites();
        }, this.FLUSH_INTERVAL_MS);
    }

    private flushWrites(): void {
        if (this.writeBuffer.length === 0) return;

        const writes = [...this.writeBuffer];
        this.writeBuffer = [];

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        try {
            // Execute all writes in a single transaction
            const transaction = this.db.transaction(() => {
                for (const write of writes) {
                    this.insertStmt.run(write.blockNumber, write.data);
                }
            });

            transaction();
        } catch (error) {
            console.error(`FATAL: Failed to flush ${writes.length} blocks to SQLite cache:`, error);
            console.error('Database corruption or filesystem failure detected. Terminating process.');
            process.exit(1);
        }
    }

    async saveBlock(blockNumber: number, block: StoredBlock): Promise<void> {
        const data = await compress(block);

        // Add to write buffer instead of writing immediately
        this.writeBuffer.push({
            blockNumber,
            data
        });

        // Flush if buffer is full
        if (this.writeBuffer.length >= this.BUFFER_SIZE) {
            this.flushWrites();
        } else {
            // Schedule a flush if not already scheduled
            this.scheduleFlush();
        }
    }

    async loadBlock(blockNumber: number): Promise<StoredBlock | null> {
        const stmt = this.db.prepare(`SELECT data FROM blocks WHERE block_number = ?`);
        const row = stmt.get(blockNumber) as { data: Buffer } | undefined;

        if (!row) {
            return null;
        }

        try {
            return await decompress(row.data) as StoredBlock;
        } catch (error) {
            console.error(`Failed to decompress block ${blockNumber}:`, error);
            return null;
        }
    }

    // Minimal stats - just count
    getCacheStats(): { totalBlocks: number } {
        const stmt = this.db.prepare(`SELECT COUNT(*) as totalBlocks FROM blocks`);
        return stmt.get() as { totalBlocks: number };
    }

    close(): void {
        // Flush any pending writes before closing
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.flushWrites();
        this.db.close();
    }
}
