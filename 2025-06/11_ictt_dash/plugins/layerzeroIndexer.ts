import { type IndexingPlugin, abiUtils, viem } from "frostbyte-sdk";
import DexalotLayerZeroEndpointV2ABI from './abi/DexalotLayerZeroEndpointV2ABI.json';

// Extract PacketSent and PacketVerified event hashes
const lzEvents: Map<string, string> = new Map();
const abi = DexalotLayerZeroEndpointV2ABI as abiUtils.AbiItem[];
const abiEventHashes = abiUtils.getEventHashesMap(abi);
for (const [hash, name] of abiEventHashes) {
    if (name === 'PacketSent' || name === 'PacketVerified') {
        lzEvents.set(hash, name);
    }
}

const eventHexes = Array.from(lzEvents.keys());

/**
 * Decodes the destination chain ID from PacketSent event's encodedPayload
 * Packet structure: version(1) + nonce(8) + srcEid(4) + sender(32) + dstEid(4) + receiver(32)
 */
function decodeDstEidFromPayload(encodedPayload: string): number {
    // Remove 0x prefix if present
    const payload = encodedPayload.startsWith('0x') ? encodedPayload.slice(2) : encodedPayload;

    // Skip: version(1) + nonce(8) + srcEid(4) + sender(32) = 45 bytes = 90 hex chars
    // dstEid is next 4 bytes = 8 hex chars
    const dstEidHex = payload.slice(90, 98);

    // Convert hex to number
    return parseInt(dstEidHex, 16);
}

const module: IndexingPlugin = {
    name: "layerzero_messages",
    version: 2,
    usesTraces: false,
    filterEvents: eventHexes,

    initialize: (db) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS layerzero_messages (
                sender TEXT NOT NULL,
                is_outgoing BOOLEAN NOT NULL,
                block_timestamp INTEGER NOT NULL,
                chain_id INTEGER NOT NULL
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
            chain_id: number;
        }[] = [];

        for (const { tx, receipt, blockTs } of batch.txs) {
            for (const log of receipt.logs) {
                const eventSignature = log.topics[0];
                if (!eventSignature) continue;

                // Check if this is a LayerZero event
                const eventName = lzEvents.get(eventSignature);
                if (!eventName) continue;

                const is_outgoing = eventName === 'PacketSent';
                let chain_id: number;

                try {
                    if (is_outgoing) {
                        // For PacketSent, decode dstEid from encodedPayload
                        const decoded = viem.decodeEventLog({
                            abi: abi,
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        });

                        const encodedPayload = (decoded.args as any).encodedPayload;
                        chain_id = decodeDstEidFromPayload(encodedPayload);
                    } else {
                        // For PacketVerified, decode srcEid from origin tuple
                        const decoded = viem.decodeEventLog({
                            abi: abi,
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        });

                        const origin = (decoded.args as any).origin;
                        chain_id = Number(origin.srcEid);
                    }

                    layerzeroMessages.push({
                        sender: tx.from,
                        is_outgoing,
                        block_timestamp: blockTs,
                        chain_id,
                    });
                } catch (error) {
                    console.error(`Failed to decode LayerZero event ${eventName}:`, error);
                    // Skip this event if decoding fails
                    continue;
                }
            }
        }

        // Insert messages into database
        if (layerzeroMessages.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO layerzero_messages (sender, is_outgoing, block_timestamp, chain_id) 
                VALUES (?, ?, ?, ?)
            `);

            for (const msg of layerzeroMessages) {
                insertStmt.run(msg.sender, msg.is_outgoing ? 1 : 0, msg.block_timestamp, msg.chain_id);
            }
        }
    }
};

export default module;
