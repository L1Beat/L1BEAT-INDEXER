import { Database, Statement } from "better-sqlite3";

export class IndexingDbHelper {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        this.initSystemTables();
    }

    private preppedQueries = new Map<string, Statement>();
    public prepQuery(query: string): Statement {
        if (this.preppedQueries.has(query)) {
            return this.preppedQueries.get(query)!;
        }
        const prepped = this.db.prepare(query);
        this.preppedQueries.set(query, prepped);
        return prepped;
    }

    initSystemTables() {
        this.prepQuery(`
    CREATE TABLE IF NOT EXISTS kv_int (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL
    ) WITHOUT ROWID;
    `).run();
    }

    setInteger(key: string, value: number) {
        this.prepQuery(`INSERT OR REPLACE INTO kv_int (key, value) VALUES (?, ?)`).run(key, value);
    }

    getInteger(key: string, defaultValue: number): number {
        const result = this.prepQuery(`SELECT value FROM kv_int WHERE key = ?`).get(key) as { value: number } | undefined;
        return result ? result.value : defaultValue;
    }
}


export function executePragmas({ db, isReadonly }: { db: Database, isReadonly: boolean }): void {
    if (isReadonly) {
        // Readonly: optimize for fast reads
        db.pragma('mmap_size = 53687091200'); // 50GB - map entire database
        db.pragma('cache_size = -32000'); // 32MB cache
        db.pragma('synchronous = OFF'); // Fastest, safe for readonly
        db.pragma('temp_store = MEMORY');
        // Don't set journal_mode - it's already set by writer and requires write access
    } else {
        // Writer: optimize for fast writes while preventing corruption
        db.pragma('mmap_size = 53687091200'); // 50GB - map entire database
        db.pragma('cache_size = -64000'); // 64MB cache
        db.pragma('synchronous = NORMAL'); // Fast but prevents corruption
        db.pragma('journal_mode = WAL'); // Only writer sets this
        db.pragma('temp_store = MEMORY');
        // db.pragma('locking_mode = EXCLUSIVE'); // Single writer optimization
    }
}
