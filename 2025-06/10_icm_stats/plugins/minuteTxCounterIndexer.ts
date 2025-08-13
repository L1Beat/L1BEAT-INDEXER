import type { IndexingPlugin } from "frostbyte-sdk";

const module: IndexingPlugin = {
    name: "minute_tx_counter",
    version: 4,
    usesTraces: false,

    wipe: async (db) => {
        db.exec('DROP TABLE IF EXISTS minute_tx_counts');
        db.exec('DROP TABLE IF EXISTS cumulative_tx_counts');
    },

    initialize: async (db) => {
        db.exec(`
            CREATE TABLE minute_tx_counts (
                minute_ts INTEGER PRIMARY KEY,  -- Unix timestamp rounded down to minute
                tx_count INTEGER NOT NULL
            );
            
            CREATE INDEX idx_minute_ts ON minute_tx_counts(minute_ts);
        `);

        db.exec(`
            CREATE TABLE cumulative_tx_counts (
                minute_ts INTEGER PRIMARY KEY,  -- Unix timestamp rounded down to minute
                cumulative_count INTEGER NOT NULL
            );
            
            CREATE INDEX idx_cumulative_minute_ts ON cumulative_tx_counts(minute_ts);
        `);
    },

    handleTxBatch: async (db, blocksDb, batch) => {
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
        const previousCumulative = db.prepare(
            'SELECT cumulative_count FROM cumulative_tx_counts WHERE minute_ts < ? ORDER BY minute_ts DESC LIMIT 1'
        ).get(firstMinuteTs) as { cumulative_count: number } | undefined;

        let runningTotal = previousCumulative?.cumulative_count || 0;

        // Prepare insert statements
        const minuteStmt = db.prepare(`
            INSERT INTO minute_tx_counts (minute_ts, tx_count)
            VALUES (?, ?)
            ON CONFLICT(minute_ts) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count
        `);

        const cumulativeStmt = db.prepare(`
            INSERT INTO cumulative_tx_counts (minute_ts, cumulative_count)
            VALUES (?, ?)
            ON CONFLICT(minute_ts) DO UPDATE SET
                cumulative_count = excluded.cumulative_count
        `);

        // Batch insert all minute counts and update cumulative counts
        for (const [minuteTs, count] of sortedMinutes) {
            // Update minute counts
            minuteStmt.run(minuteTs, count);

            // Update running total and insert cumulative count
            runningTotal += count;
            cumulativeStmt.run(minuteTs, runningTotal);
        }
    }
};

export default module; 
