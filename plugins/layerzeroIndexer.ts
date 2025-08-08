import { type IndexingPlugin, abiUtils } from "frostbyte-sdk";
import DexalotLayerZeroEndpointV2ABI from './abi/DexalotLayerZeroEndpointV2ABI.json';

// Extract PacketSent and PacketReceived event hashes
const lzEvents: Map<string, string> = new Map();
const abi = DexalotLayerZeroEndpointV2ABI as abiUtils.AbiItem[];
const abiEventHashes = abiUtils.getEventHashesMap(abi);
for (const [hash, name] of abiEventHashes) {
    if (name === 'PacketSent' || name === 'PacketReceived') {
        lzEvents.set(hash, name);
    }
}

const eventHexes = Array.from(lzEvents.keys());

const module: IndexingPlugin = {
    name: "layerzero_messages",
    version: 1,
    usesTraces: false,
    filterEvents: eventHexes,

    initialize: (db) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS layerzero_messages (
                sender TEXT NOT NULL,
                is_outgoing BOOLEAN NOT NULL,
                block_timestamp INTEGER NOT NULL
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_layerzero_messages_time_direction 
            ON layerzero_messages(block_timestamp, is_outgoing)
        `);
    },

    handleTxBatch: (db, blocksDb, batch) => {
        // Accumulate messages in memory
        const layerzeroMessages: {
            sender: string;
            is_outgoing: boolean;
            block_timestamp: number;
        }[] = [];

        for (const { tx, receipt, blockTs } of batch.txs) {
            for (const log of receipt.logs) {
                const eventSignature = log.topics[0];
                if (!eventSignature) continue;

                // Check if this is a LayerZero event
                const eventName = lzEvents.get(eventSignature);
                if (!eventName) continue;

                const is_outgoing = eventName === 'PacketSent';

                layerzeroMessages.push({
                    sender: tx.from,
                    is_outgoing,
                    block_timestamp: blockTs,
                });
            }
        }

        // Insert messages into database
        if (layerzeroMessages.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO layerzero_messages (sender, is_outgoing, block_timestamp) 
                VALUES (?, ?, ?)
            `);

            for (const msg of layerzeroMessages) {
                insertStmt.run(msg.sender, msg.is_outgoing ? 1 : 0, msg.block_timestamp);
            }
        }
    }
};

export default module;
