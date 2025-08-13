import SQLite3 from 'better-sqlite3'
import { cacheStatement } from '../lib/statementCache'

const createConfigTableSQL = `
CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY, 
    value TEXT
) WITHOUT ROWID;

INSERT OR IGNORE INTO configs (key, value) VALUES ('last_processed_block', '-1');
INSERT OR IGNORE INTO configs (key, value) VALUES ('latest_block_number', 0);
INSERT OR IGNORE INTO configs (key, value) VALUES ('last_updated_timestamp', '0');
`

export function initialize(db: SQLite3.Database) {
    db.exec(createConfigTableSQL)
}

export function setLastProcessedBlock(db: SQLite3.Database, blockNumber: number) {
    const stmt = cacheStatement(db, "UPDATE configs SET value = ? WHERE key = 'last_processed_block'")
    stmt.run(blockNumber.toString())
}

export function getLastProcessedBlock(db: SQLite3.Database) {
    const stmt = cacheStatement(db, "SELECT value FROM configs WHERE key = 'last_processed_block'")
    const result = stmt.get() as { value: string }
    return Number(result.value)
}

export function getLatestBlockNumber(db: SQLite3.Database) {
    const stmt = cacheStatement(db, "SELECT value FROM configs WHERE key = 'latest_block_number'")
    const result = stmt.get() as { value: string }
    return Number(result.value)
}

export function setLatestBlockNumber(db: SQLite3.Database, blockNumber: number) {
    const stmt = cacheStatement(db, "UPDATE configs SET value = ? WHERE key = 'latest_block_number'")
    stmt.run(blockNumber.toString())
}

export function getLastUpdatedTimestamp(db: SQLite3.Database) {
    const stmt = cacheStatement(db, "SELECT value FROM configs WHERE key = 'last_updated_timestamp'")
    const result = stmt.get() as { value: string }
    return Number(result.value)
}

export function setLastUpdatedTimestamp(db: SQLite3.Database, timestamp: number) {
    const stmt = cacheStatement(db, "UPDATE configs SET value = ? WHERE key = 'last_updated_timestamp'")
    stmt.run(timestamp.toString())
}
