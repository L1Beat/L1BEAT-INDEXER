import type { IndexingPlugin } from "frostbyte-sdk";

const module: IndexingPlugin = {
    name: "period_tx_counter",
    version: 2,
    usesTraces: false,

    initialize: (db) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_tx_counts (
                day_ts INTEGER NOT NULL,        -- Unix timestamp of start of day (00:00:00 UTC)
                tx_count INTEGER NOT NULL,
                gas_used INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (day_ts)
            );

            CREATE TABLE IF NOT EXISTS monthly_tx_counts (
                month_ts INTEGER NOT NULL,        -- Unix timestamp of start of month (00:00:00 UTC)
                tx_count INTEGER NOT NULL,
                gas_used INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (month_ts)
            );
        `);

        // Index for efficient date range queries
        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_daily_day_ts ON daily_tx_counts(day_ts);
                CREATE INDEX IF NOT EXISTS idx_monthly_month_ts ON monthly_tx_counts(month_ts);
            `);
        } catch (error: any) {
            // Ignore error if index already exists
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    },

    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate tx counts and gas usage by day and month in memory
        const dayStats = new Map<number, { count: number, gasUsed: number }>();
        const monthStats = new Map<number, { count: number, gasUsed: number }>();

        for (const tx of batch.txs) {
            const ts = tx.blockTs;

            // Round down to start of day (00:00:00 UTC)
            const dayTs = Math.floor(ts / 86400) * 86400;
            const dayData = dayStats.get(dayTs) || { count: 0, gasUsed: 0 };
            dayData.count += 1;
            dayData.gasUsed += Number(tx.receipt.gasUsed || 0);
            dayStats.set(dayTs, dayData);

            // Round down to start of month (00:00:00 UTC on the 1st)
            const date = new Date(ts * 1000);
            date.setUTCDate(1);
            date.setUTCHours(0, 0, 0, 0);
            const monthTs = Math.floor(date.getTime() / 1000);
            const monthData = monthStats.get(monthTs) || { count: 0, gasUsed: 0 };
            monthData.count += 1;
            monthData.gasUsed += Number(tx.receipt.gasUsed || 0);
            monthStats.set(monthTs, monthData);
        }

        // Only write to DB if we have accumulated data
        if (dayStats.size === 0 && monthStats.size === 0) return;

        // Prepare statements for batch operations
        const upsertDayStmt = db.prepare(`
            INSERT INTO daily_tx_counts (day_ts, tx_count, gas_used)
            VALUES (?, ?, ?)
            ON CONFLICT(day_ts) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count,
                gas_used = gas_used + excluded.gas_used
        `);

        const upsertMonthStmt = db.prepare(`
            INSERT INTO monthly_tx_counts (month_ts, tx_count, gas_used)
            VALUES (?, ?, ?)
            ON CONFLICT(month_ts) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count,
                gas_used = gas_used + excluded.gas_used
        `);

        // Process each day
        for (const [dayTs, stats] of dayStats) {
            upsertDayStmt.run(dayTs, stats.count, stats.gasUsed);
        }

        // Process each month
        for (const [monthTs, stats] of monthStats) {
            upsertMonthStmt.run(monthTs, stats.count, stats.gasUsed);
        }
    }
};

export default module;