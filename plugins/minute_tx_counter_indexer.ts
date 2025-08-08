import type { IndexingPlugin } from "frostbyte-sdk";

const module: IndexingPlugin = {
    name: "minute_tx_counter",
    version: 6,
    usesTraces: false,

    initialize: (db) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS minute_tx_counts (
                minute_ts INTEGER PRIMARY KEY,  -- Unix timestamp rounded down to minute
                tx_count INTEGER NOT NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS cumulative_tx_counts (
                minute_ts INTEGER PRIMARY KEY,  -- Unix timestamp rounded down to minute
                cumulative_count INTEGER NOT NULL
            )
        `);

        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_minute_ts ON minute_tx_counts(minute_ts)
            `);
        } catch (error: any) {
            // Ignore error if index already exists
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_cumulative_minute_ts ON cumulative_tx_counts(minute_ts)
            `);
        } catch (error: any) {
            // Ignore error if index already exists
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    },

    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate tx counts by minute in memory
        const minuteCounts = new Map<number, number>();

        for (const tx of batch.txs) {
            const ts = tx.blockTs;
            const minuteTs = Math.floor(ts / 60) * 60;
            minuteCounts.set(minuteTs, (minuteCounts.get(minuteTs) || 0) + 1);
        }

        // Only write to DB if we have accumulated enough data
        if (minuteCounts.size === 0) return;

        // Sort minutes to process them in chronological order
        const sortedMinutes = Array.from(minuteCounts.entries()).sort((a, b) => a[0] - b[0]);
        const firstMinuteTs = sortedMinutes[0]![0];

        // Get the cumulative count just before our first minute
        const selectStmt = db.prepare(
            'SELECT cumulative_count FROM cumulative_tx_counts WHERE minute_ts < ? ORDER BY minute_ts DESC LIMIT 1'
        );
        const previousCumulative = selectStmt.get(firstMinuteTs) as { cumulative_count: number } | undefined;

        let runningTotal = previousCumulative?.cumulative_count || 0;

        // Prepare statements for batch operations
        const insertMinuteStmt = db.prepare(`
            INSERT INTO minute_tx_counts (minute_ts, tx_count)
            VALUES (?, ?)
            ON CONFLICT(minute_ts) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count
        `);

        const insertCumulativeStmt = db.prepare(`
            INSERT INTO cumulative_tx_counts (minute_ts, cumulative_count)
            VALUES (?, ?)
            ON CONFLICT(minute_ts) DO UPDATE SET
                cumulative_count = excluded.cumulative_count
        `);

        // Process each minute
        for (const [minuteTs, count] of sortedMinutes) {
            // Insert minute count
            insertMinuteStmt.run(minuteTs, count);

            // Update running total and insert cumulative count
            runningTotal += count;
            insertCumulativeStmt.run(minuteTs, runningTotal);
        }
    }
};

export default module; 
