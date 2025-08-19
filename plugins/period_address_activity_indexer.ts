import type { IndexingPlugin } from "frostbyte-sdk";

const module: IndexingPlugin = {
    name: "period_address_activity",
    version: 2,
    usesTraces: false,

    initialize: (db) => {
        // Table to track unique addresses per 4-hour period
        db.exec(`
            CREATE TABLE IF NOT EXISTS period_address_activity (
                period_ts INTEGER NOT NULL,  -- Unix timestamp rounded down to 4-hour period
                address TEXT NOT NULL,
                tx_count INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (period_ts, address)
            )
        `);

        // Note: No additional indexes needed - the composite PRIMARY KEY (period_ts, address) 
        // is sufficient for both INSERT ON CONFLICT operations and queries
    },

    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate data in memory
        const periodAddressMap = new Map<number, Map<string, number>>();
        const FOUR_HOURS = 14400; // 4 hours in seconds

        for (const tx of batch.txs) {
            // Round down to 4-hour period
            const periodTs = Math.floor(tx.blockTs / FOUR_HOURS) * FOUR_HOURS;

            // Get or create the address map for this period
            if (!periodAddressMap.has(periodTs)) {
                periodAddressMap.set(periodTs, new Map());
            }
            const addressMap = periodAddressMap.get(periodTs)!;

            // Track 'from' address
            const fromAddress = tx.tx.from;
            addressMap.set(fromAddress, (addressMap.get(fromAddress) || 0) + 1);

            // Track 'to' address if it exists
            if (tx.tx.to) {
                const toAddress = tx.tx.to;
                addressMap.set(toAddress, (addressMap.get(toAddress) || 0) + 1);
            }
        }

        if (periodAddressMap.size === 0) return;

        // Prepare statement for batch operations
        const insertAddressStmt = db.prepare(`
            INSERT INTO period_address_activity (period_ts, address, tx_count)
            VALUES (?, ?, ?)
            ON CONFLICT(period_ts, address) DO UPDATE SET
                tx_count = tx_count + excluded.tx_count
        `);

        // Process each period
        for (const [periodTs, addressMap] of periodAddressMap) {
            // Insert address activity
            for (const [address, txCount] of addressMap) {
                insertAddressStmt.run(periodTs, address, txCount);
            }
        }
    }
};

export default module;