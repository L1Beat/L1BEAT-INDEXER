import SQLite3 from "better-sqlite3"
import { DEFAULT_PRAGMAS } from "./pragmas"
import * as config from "./config"
import * as metrics from "./metrics"

export function initIndexerDb(db: SQLite3.Database) {
    db.exec(DEFAULT_PRAGMAS)
    config.initialize(db)
    metrics.initialize(db)

    db.pragma('optimize')
}
