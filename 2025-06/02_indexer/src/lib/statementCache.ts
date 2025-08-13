import SQLite3 from 'better-sqlite3'

// Use WeakMap so cache is automatically cleaned up when database is garbage collected
const dbCaches = new WeakMap<SQLite3.Database, Map<string, SQLite3.Statement>>()

export function cacheStatement(db: SQLite3.Database, sql: string): SQLite3.Statement {
    // Get or create cache for this database
    let sqlCache = dbCaches.get(db)
    if (!sqlCache) {
        sqlCache = new Map()
        dbCaches.set(db, sqlCache)
    }

    // Check if statement is already cached
    let statement = sqlCache.get(sql)
    if (!statement) {
        // Prepare and cache the statement
        statement = db.prepare(sql)
        sqlCache.set(sql, statement)
    }

    return statement
}
