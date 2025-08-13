import Database from 'better-sqlite3';
import { compress, decompress } from "../compressor/compress";

export class ArchiverDB {
    private db: Database.Database;
    private getBlockStmt: Database.Statement;
    private saveBlockStmt: Database.Statement;
    private getConfigStmt: Database.Statement;
    private saveConfigStmt: Database.Statement;

    constructor(folder: string) {
        this.db = new Database(folder);

        // Create tables if they don't exist
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS blocks_archive (
                block_number TEXT PRIMARY KEY,
                data BLOB NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL
            );
        `);

        // Prepare statements for better performance
        this.getBlockStmt = this.db.prepare('SELECT data FROM blocks_archive WHERE block_number = ?');
        this.saveBlockStmt = this.db.prepare('INSERT OR REPLACE INTO blocks_archive (block_number, data) VALUES (?, ?)');
        this.getConfigStmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
        this.saveConfigStmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    }

    async saveBlock(blockNumber: number | bigint, blockData: unknown): Promise<void> {
        const compressedBuffer = await compress(blockData);
        this.saveBlockStmt.run(blockNumber.toString(), compressedBuffer);
    }

    async loadBlock<T = unknown>(blockNumber: number | bigint): Promise<T> {
        const row = this.getBlockStmt.get(blockNumber.toString()) as { data: Buffer } | undefined;
        if (!row || !row.data) throw new Error(`Block not found: ${blockNumber}`);
        return await decompress<T>(row.data);
    }

    async saveConfigValue(key: string, value: unknown): Promise<void> {
        const compressedBuffer = await compress(value);
        this.saveConfigStmt.run(key, compressedBuffer);
    }

    async loadConfigValue<T = unknown>(key: string): Promise<T> {
        const row = this.getConfigStmt.get(key) as { value: Buffer } | undefined;
        if (!row || !row.value) throw new Error(`Config key not found: ${key}`);
        return await decompress<T>(row.value);
    }

    async close(): Promise<void> {
        this.db.close();
    }
}
