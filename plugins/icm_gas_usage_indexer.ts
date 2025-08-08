import type { IndexingPlugin } from "frostbyte-sdk";
import { encodingUtils, viem } from "frostbyte-sdk";

// Teleporter contract address
const TELEPORTER_ADDRESS = "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf";

// Event topic signatures
const SEND_CROSS_CHAIN_MESSAGE_TOPIC = '0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8';
const RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC = '0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34';

interface ChainIntervalStats {
    send_count: number;
    receive_count: number;
    send_gas_cost: bigint;
    receive_gas_cost: bigint;
}

export const ICM_CHAIN_INTERVAL_SIZE = 300; // 5 minutes

const module: IndexingPlugin = {
    name: "icm_gas_usage",
    version: 21,
    usesTraces: false,
    filterEvents: [SEND_CROSS_CHAIN_MESSAGE_TOPIC, RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC],

    // Initialize tables
    initialize: (db) => {
        // Create table for per-chain per-interval statistics
        db.exec(`
            CREATE TABLE IF NOT EXISTS icm_chain_interval_stats (
                other_chain_id TEXT,
                interval_ts INTEGER,
                send_count INTEGER NOT NULL DEFAULT 0,
                receive_count INTEGER NOT NULL DEFAULT 0,
                send_gas_cost REAL NOT NULL DEFAULT 0,
                receive_gas_cost REAL NOT NULL DEFAULT 0,
                PRIMARY KEY (other_chain_id, interval_ts)
            )
        `);

        // Create index for queries
        try {
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_icm_chain_interval_ts ON icm_chain_interval_stats(interval_ts)
            `);
        } catch (error: any) {
            // Ignore if already exists
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }
    },

    // Process transactions
    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate updates per chain per interval
        const updates = new Map<string, Map<number, ChainIntervalStats>>();

        for (const tx of batch.txs) {
            const gasUsed = BigInt(tx.receipt.gasUsed || '0');
            const gasPrice = BigInt(tx.receipt.effectiveGasPrice || '0');
            const gasCost = gasUsed * gasPrice; // Cost in wei
            const intervalTs = Math.floor(tx.blockTs / ICM_CHAIN_INTERVAL_SIZE) * ICM_CHAIN_INTERVAL_SIZE;

            // First, count all ICM events in this transaction
            let sendEventCount = 0;
            let receiveEventCount = 0;

            for (const log of tx.receipt.logs) {
                if (log.address !== TELEPORTER_ADDRESS) continue;
                const topic = log.topics[0];
                if (topic === SEND_CROSS_CHAIN_MESSAGE_TOPIC) sendEventCount++;
                if (topic === RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC) receiveEventCount++;
            }

            const totalEventCount = sendEventCount + receiveEventCount;
            if (totalEventCount === 0) continue;

            // Calculate gas cost per event
            const gasCostPerEvent = gasCost / BigInt(totalEventCount);

            // Now process events and allocate costs
            for (const log of tx.receipt.logs) {
                if (log.address !== TELEPORTER_ADDRESS) continue;
                const topic = log.topics[0];

                let chainId: string;
                let isSend: boolean;

                if (topic === SEND_CROSS_CHAIN_MESSAGE_TOPIC) {
                    chainId = encodingUtils.hexToCB58(log.topics[2] || '0x0');
                    isSend = true;
                } else if (topic === RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC) {
                    chainId = encodingUtils.hexToCB58(log.topics[2] || '0x0');
                    isSend = false;
                } else {
                    continue;
                }

                // Get or create chain map
                if (!updates.has(chainId)) {
                    updates.set(chainId, new Map());
                }
                const chainMap = updates.get(chainId)!;

                // Get or create interval stats
                if (!chainMap.has(intervalTs)) {
                    chainMap.set(intervalTs, {
                        send_count: 0,
                        receive_count: 0,
                        send_gas_cost: 0n,
                        receive_gas_cost: 0n
                    });
                }
                const stats = chainMap.get(intervalTs)!;

                if (isSend) {
                    stats.send_count += 1;
                    stats.send_gas_cost += gasCostPerEvent;
                } else {
                    stats.receive_count += 1;
                    stats.receive_gas_cost += gasCostPerEvent;
                }
            }
        }

        // Prepare statements for batch insert/update
        const insertStmt = db.prepare(`
            INSERT INTO icm_chain_interval_stats 
            (other_chain_id, interval_ts, send_count, receive_count, send_gas_cost, receive_gas_cost)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(other_chain_id, interval_ts) DO UPDATE SET
                send_count = send_count + excluded.send_count,
                receive_count = receive_count + excluded.receive_count,
                send_gas_cost = send_gas_cost + excluded.send_gas_cost,
                receive_gas_cost = receive_gas_cost + excluded.receive_gas_cost
        `);

        // Update database
        for (const [chainId, chainMap] of updates) {
            for (const [intervalTs, stats] of chainMap) {
                // Convert from wei to ETH/AVAX (divide by 10^18)
                const sendGasCostInEth = Number(stats.send_gas_cost) / 1e18;
                const receiveGasCostInEth = Number(stats.receive_gas_cost) / 1e18;

                insertStmt.run(chainId, intervalTs, stats.send_count, stats.receive_count, sendGasCostInEth, receiveGasCostInEth);
            }
        }

        // Optional logging
        if (updates.size > 0) {
            console.log(`ICM Burner: Updated stats for ${updates.size} chains across ${Array.from(updates.values()).reduce((sum, m) => sum + m.size, 0)} intervals`);
        }
    }
};

export default module;
