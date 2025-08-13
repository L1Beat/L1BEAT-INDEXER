import type { IndexingPlugin } from "frostbyte-sdk";

const module: IndexingPlugin = {
    name: "daily_active_addresses",
    version: 1,
    usesTraces: false,

    initialize: (db) => {
        // Table to track unique addresses per day
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_address_activity (
                day_ts INTEGER NOT NULL,  -- Unix timestamp rounded down to midnight UTC
                address TEXT NOT NULL,
                tx_count INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (day_ts, address)
            )
        `);

        // Table to store daily summaries for quick queries
        db.exec(`
            CREATE TABLE IF NOT EXISTS daily_active_counts (
                day_ts INTEGER PRIMARY KEY,  -- Unix timestamp rounded down to midnight UTC
                active_addresses INTEGER NOT NULL,
                total_txs INTEGER NOT NULL
            )
        `);

        // Create indexes for performance
        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_daily_address_day_ts ON daily_address_activity(day_ts)
            `);
        } catch (error: any) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_daily_address_address ON daily_address_activity(address)
            `);
        } catch (error: any) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    },

    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate data in memory
        const dailyAddressMap = new Map<number, Map<string, number>>();
        const dailyTxCounts = new Map<number, number>();

        for (const tx of batch.txs) {
            // Round down to midnight UTC
            const dayTs = Math.floor(tx.blockTs / 86400) * 86400;
            const fromAddress = tx.tx.from;

            // Get or create the address map for this day
            if (!dailyAddressMap.has(dayTs)) {
                dailyAddressMap.set(dayTs, new Map());
            }
            const addressMap = dailyAddressMap.get(dayTs)!;

            // Increment tx count for this address
            addressMap.set(fromAddress, (addressMap.get(fromAddress) || 0) + 1);

            // Track total txs per day
            dailyTxCounts.set(dayTs, (dailyTxCounts.get(dayTs) || 0) + 1);
        }

        if (dailyAddressMap.size === 0) return;

        // Prepare statements
        const insertAddressStmt = db.prepare(`
            INSERT INTO daily_address_activity (day_ts, address, tx_count)
            VALUES (?, ?, ?)
            ON CONFLICT(day_ts, address) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count
        `);

        const updateDailyCountsStmt = db.prepare(`
            INSERT INTO daily_active_counts (day_ts, active_addresses, total_txs)
            VALUES (?, 
                (SELECT COUNT(DISTINCT address) FROM daily_address_activity WHERE day_ts = ?),
                (SELECT SUM(tx_count) FROM daily_address_activity WHERE day_ts = ?)
            )
            ON CONFLICT(day_ts) DO UPDATE SET
                active_addresses = (SELECT COUNT(DISTINCT address) FROM daily_address_activity WHERE day_ts = ?),
                total_txs = (SELECT SUM(tx_count) FROM daily_address_activity WHERE day_ts = ?)
        `);

        // Process each day
        for (const [dayTs, addressMap] of dailyAddressMap) {
            // Insert address activity
            for (const [address, txCount] of addressMap) {
                insertAddressStmt.run(dayTs, address, txCount);
            }

            // Update daily summary
            updateDailyCountsStmt.run(dayTs, dayTs, dayTs, dayTs, dayTs);
        }
    }
};

export default module;
