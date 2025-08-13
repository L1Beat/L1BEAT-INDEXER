import SQLite from "better-sqlite3";
import { toBytes, fromBytes } from 'viem';
import type { Hex } from 'viem';
import { DATA_FOLDER } from "../config";

const schema = `
PRAGMA page_size = 4096;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -64000;
PRAGMA wal_autocheckpoint = 10000;
PRAGMA checkpoint_fullfsync = OFF;

CREATE TABLE IF NOT EXISTS tx_block_lookup (
    hash_to_block BLOB PRIMARY KEY
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY, 
    value TEXT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS stats (
    frequency TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    metric TEXT NOT NULL,
    submetric TEXT NOT NULL DEFAULT '',
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (frequency, bucket, metric, submetric)
) WITHOUT ROWID;

INSERT OR IGNORE INTO configs (key, value) VALUES ('last_processed_block', '-1');
INSERT OR IGNORE INTO configs (key, value) VALUES ('latest_block_number', 0);
`

export function initializeDatabase(blockchainID: string): SQLite.Database {
    const dbPath = `${DATA_FOLDER}/${blockchainID}/index.sqlite`;
    const db = new SQLite(dbPath);

    db.exec(schema);

    return db;
}

export class Database {
    private db: SQLite.Database;
    private stmtCache = new Map<string, SQLite.Statement>();

    constructor(db: SQLite.Database) {
        this.db = db;
    }

    private prepareCached(sql: string): SQLite.Statement {
        let stmt = this.stmtCache.get(sql);
        if (!stmt) {
            stmt = this.db.prepare(sql);
            this.stmtCache.set(sql, stmt);
        }
        return stmt;
    }

    insertTxBlockLookup(txHash: Hex, blockNumber: number): void {
        const SQL = `INSERT INTO tx_block_lookup (hash_to_block) VALUES (?) ON CONFLICT(hash_to_block) DO NOTHING`;
        const txHashBytes = toBytes(txHash);
        const lookupKey = Buffer.from([...txHashBytes.slice(0, 5), ...toBytes(blockNumber)]);
        this.prepareCached(SQL).run(lookupKey);
    }

    private updateConfig(key: string, value: string): void {
        const SQL = `UPDATE configs SET value = ? WHERE key = ?`;
        this.prepareCached(SQL).run(value, key);
    }

    private getConfig(key: string): string | null {
        const SQL = `SELECT value FROM configs WHERE key = ?`;
        const result = this.prepareCached(SQL).get(key) as { value: string } | undefined;
        return result?.value || null;
    }

    getTxLookupByPrefix(txHash: Hex): number[] {
        const SQL = `SELECT hash_to_block FROM tx_block_lookup WHERE hex(hash_to_block) LIKE ?`;
        const fullTxHashBytes = toBytes(txHash);
        const prefixBytes = fullTxHashBytes.slice(0, 5);
        const prefixHex = Buffer.from(prefixBytes).toString('hex');

        const lookupKeyRows = this.prepareCached(SQL).all(`${prefixHex}%`) as { hash_to_block: Buffer }[];

        const blockNumbers: number[] = [];
        for (const row of lookupKeyRows) {
            const lookupKeyBlob = row.hash_to_block;
            // Ensure lookupKeyBlob is long enough (prefix + at least 1 byte for number)
            if (lookupKeyBlob.length > 5) {
                const blockNumberBytes = lookupKeyBlob.slice(5);
                try {
                    const blockNumber = fromBytes(blockNumberBytes, 'number');
                    blockNumbers.push(blockNumber);
                } catch (e) {
                    console.error(`Error parsing block number from lookup key ${lookupKeyBlob.toString('hex')}:`, e);
                }
            }
        }

        return blockNumbers;
    }

    private recordStats(metric: string, submetric: string, value: number, blockTimestamp: number): void {
        const hourBucket = Math.floor(blockTimestamp / 3600);
        const dayBucket = Math.floor(blockTimestamp / 86400);
        const weekBucket = Math.floor(blockTimestamp / 604800); // 7 * 24 * 60 * 60 = 604800

        const STATS_SQL = `INSERT INTO stats (frequency, bucket, metric, submetric, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT(frequency, bucket, metric, submetric) DO UPDATE SET value = value + excluded.value`;

        this.prepareCached(STATS_SQL).run('1h', hourBucket, metric, submetric, value);
        this.prepareCached(STATS_SQL).run('1d', dayBucket, metric, submetric, value);
        this.prepareCached(STATS_SQL).run('1w', weekBucket, metric, submetric, value);
    }

    recordTxCount(txCount: number, blockTimestamp: number): void {
        this.recordStats('txCnt', '', txCount, blockTimestamp);
    }

    recordICMMessagesSent(count: number, receiverChainId: string, blockTimestamp: number): void {
        this.recordStats('icmSent', receiverChainId, count, blockTimestamp);
    }

    recordICMMessagesReceived(count: number, senderChainId: string, blockTimestamp: number): void {
        this.recordStats('icmReceived', senderChainId, count, blockTimestamp);
    }

    private getMetric(frequency: '1h' | '1d' | '1w', metric: string, submetric: string, limit: number = 10): Array<{ timestamp: number; value: number }> {
        const SQL = `SELECT bucket, value FROM stats WHERE frequency = ? AND metric = ? AND submetric = ? AND bucket >= ? ORDER BY bucket DESC LIMIT ?`;
        const now = Math.floor(Date.now() / 1000);
        const bucketSize = frequency === '1h' ? 3600 : frequency === '1d' ? 86400 : 604800;
        const currentBucket = Math.floor(now / bucketSize);
        const startBucket = currentBucket - limit + 1;

        const rows = this.prepareCached(SQL).all(frequency, metric, submetric, startBucket, limit) as Array<{ bucket: number; value: number }>;

        // Create a map for quick lookup
        const dataMap = new Map<number, number>();
        for (const row of rows) {
            dataMap.set(row.bucket, row.value);
        }

        // Fill in missing buckets with zeros
        const result: Array<{ timestamp: number; value: number }> = [];
        for (let bucket = startBucket; bucket <= currentBucket; bucket++) {
            const value = dataMap.get(bucket) || 0;
            result.push({
                timestamp: bucket * bucketSize,
                value: value
            });
        }

        return result.slice(-limit);
    }

    private getMetricWithSubmetric(frequency: '1h' | '1d' | '1w', metric: string, limit: number = 10): Array<{ timestamp: number; value: Record<string, number> }> {
        const SQL = `SELECT bucket, submetric, value FROM stats WHERE frequency = ? AND metric = ? AND bucket >= ? ORDER BY bucket DESC, submetric`;
        const now = Math.floor(Date.now() / 1000);
        const bucketSize = frequency === '1h' ? 3600 : frequency === '1d' ? 86400 : 604800;
        const currentBucket = Math.floor(now / bucketSize);
        const startBucket = currentBucket - limit + 1;

        const rows = this.prepareCached(SQL).all(frequency, metric, startBucket) as Array<{ bucket: number; submetric: string; value: number }>;

        // Group by bucket and submetric
        const dataMap = new Map<number, Record<string, number>>();
        for (const row of rows) {
            if (!dataMap.has(row.bucket)) {
                dataMap.set(row.bucket, {});
            }
            dataMap.get(row.bucket)![row.submetric] = row.value;
        }

        // Fill in missing buckets with empty objects
        const result: Array<{ timestamp: number; value: Record<string, number> }> = [];
        for (let bucket = startBucket; bucket <= currentBucket; bucket++) {
            const value = dataMap.get(bucket) || {};
            result.push({
                timestamp: bucket * bucketSize,
                value: value
            });
        }

        return result.slice(-limit);
    }

    getTxCount(frequency: '1h' | '1d' | '1w', limit: number = 10): Array<{ timestamp: number; value: number }> {
        return this.getMetric(frequency, 'txCnt', '', limit);
    }

    getIcmOut(frequency: '1h' | '1d' | '1w', limit: number = 10): Array<{ timestamp: number; value: Record<string, number> }> {
        return this.getMetricWithSubmetric(frequency, 'icmSent', limit);
    }

    getIcmIn(frequency: '1h' | '1d' | '1w', limit: number = 10): Array<{ timestamp: number; value: Record<string, number> }> {
        return this.getMetricWithSubmetric(frequency, 'icmReceived', limit);
    }

    transaction<T>(fn: () => T): T {
        return this.db.transaction(fn)();
    }

    // Expose the raw database for complex queries like in IndexerAPI
    getRawDb(): SQLite.Database {
        return this.db;
    }

    getLastProcessedBlock(): number {
        const lastProcessedBlock = this.getConfig('last_processed_block');
        return parseInt(lastProcessedBlock || '-1');
    }

    setLastProcessedBlock(blockNumber: number): void {
        this.updateConfig('last_processed_block', blockNumber.toString());
    }

    getLatestBlockNumber(): number | null {
        const latestBlock = this.getConfig('latest_block_number');
        return latestBlock ? parseInt(latestBlock) : null;
    }

    setLatestBlockNumber(blockNumber: number): void {
        this.updateConfig('latest_block_number', blockNumber.toString());
    }
}
