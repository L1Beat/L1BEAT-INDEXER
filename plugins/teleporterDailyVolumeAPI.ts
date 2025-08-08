import type { ApiPlugin } from "frostbyte-sdk";

type DailyVolume = {
    timestamp: number;
    date: string;
    messageCount: number;
}

type ChainPairKey = `${string}->${string}`;

interface MessageCountRow {
    is_outgoing: number;
    other_chain_id: string;
    message_count: number;
}

const module: ApiPlugin = {
    name: "teleporter_daily_volume",
    requiredIndexers: ["teleporter_messages"],

    registerRoutes: (app, dbCtx) => {
        app.get('/api/global/metrics/dailyMessageVolume', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        days: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 7
                        }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                timestamp: { type: 'number' },
                                date: { type: 'string' },
                                messageCount: { type: 'number' }
                            },
                            required: ['timestamp', 'date', 'messageCount']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const { days = 7 } = request.query as { days?: number };

            // Get current timestamp in seconds
            const now = Math.floor(Date.now() / 1000);
            const configs = dbCtx.getAllChainConfigs();

            // Create array for daily volumes
            const dailyVolumes: DailyVolume[] = [];

            // Process each 24-hour period
            for (let i = 0; i < days; i++) {
                const endTime = now - (i * 86400); // 86400 seconds = 24 hours
                const startTime = endTime - 86400;

                // Map to store message counts per chain pair for deduplication
                const pairCounts = new Map<ChainPairKey, {
                    incomingCount?: number;
                    outgoingCount?: number;
                }>();

                // Query each chain's database
                for (const config of configs) {
                    try {
                        const indexerConn = dbCtx.getIndexerDbConnection(config.evmChainId, "teleporter_messages");

                        // Query grouped counts for messages in this time period
                        const stmt = indexerConn.prepare(`
                            SELECT
                                is_outgoing,
                                other_chain_id,
                                COUNT(*) as message_count
                            FROM teleporter_messages
                            WHERE block_timestamp >= ? AND block_timestamp < ?
                            GROUP BY is_outgoing, other_chain_id
                        `);
                        const results = stmt.all(startTime, endTime) as MessageCountRow[];

                        // Process results for deduplication
                        for (const row of results) {
                            if (row.is_outgoing === 1) {
                                // Outgoing: from this chain to other chain
                                const key: ChainPairKey = `${config.blockchainId}->${row.other_chain_id}`;
                                const existing = pairCounts.get(key) || {};
                                existing.outgoingCount = row.message_count;
                                pairCounts.set(key, existing);
                            } else {
                                // Incoming: from other chain to this chain
                                const key: ChainPairKey = `${row.other_chain_id}->${config.blockchainId}`;
                                const existing = pairCounts.get(key) || {};
                                existing.incomingCount = row.message_count;
                                pairCounts.set(key, existing);
                            }
                        }
                    } catch (error) {
                        // Chain might not have the teleporter_messages indexer
                        console.log(`Skipping chain ${config.chainName} - teleporter indexer not found`);
                    }
                }

                // Calculate total messages for this day, preferring incoming counts
                let totalMessages = 0;
                for (const [_, data] of pairCounts) {
                    // Prefer incoming count over outgoing count to avoid double counting
                    totalMessages += data.incomingCount ?? data.outgoingCount ?? 0;
                }

                // Create date string for this period
                const dateObj = new Date(endTime * 1000);
                const dateStr = dateObj.toISOString().split('T')[0]!; // YYYY-MM-DD format

                dailyVolumes.push({
                    timestamp: endTime,
                    date: dateStr,
                    messageCount: totalMessages
                });
            }

            return reply.send(dailyVolumes);
        });

        // Per-chain daily message volume endpoint
        app.get<{
            Params: { evmChainId: string };
            Querystring: { days?: number }
        }>('/api/:evmChainId/metrics/dailyMessageVolume', {
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        evmChainId: { type: 'string' }
                    },
                    required: ['evmChainId']
                },
                querystring: {
                    type: 'object',
                    properties: {
                        days: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 7
                        }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                timestamp: { type: 'number' },
                                date: { type: 'string' },
                                messageCount: { type: 'number' },
                                incomingCount: { type: 'number' },
                                outgoingCount: { type: 'number' }
                            },
                            required: ['timestamp', 'date', 'messageCount', 'incomingCount', 'outgoingCount']
                        }
                    },
                    404: {
                        type: 'object',
                        properties: {
                            error: { type: 'string' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const evmChainId = parseInt(request.params.evmChainId);
            const { days = 7 } = request.query;

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find(c => c.evmChainId === evmChainId);
            if (!chainConfig) {
                return reply.code(404).send({ error: `Chain ${evmChainId} not found` });
            }

            // Check if chain has teleporter indexer
            try {
                const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, "teleporter_messages");

                // Get current timestamp in seconds
                const now = Math.floor(Date.now() / 1000);

                // Create array for daily volumes
                const dailyVolumes: (DailyVolume & { incomingCount: number; outgoingCount: number })[] = [];

                // Process each 24-hour period
                for (let i = 0; i < days; i++) {
                    const endTime = now - (i * 86400); // 86400 seconds = 24 hours
                    const startTime = endTime - 86400;

                    // Query counts for this chain
                    const stmt = indexerConn.prepare(`
                        SELECT
                            is_outgoing,
                            COUNT(*) as message_count
                        FROM teleporter_messages
                        WHERE block_timestamp >= ? AND block_timestamp < ?
                        GROUP BY is_outgoing
                    `);
                    const results = stmt.all(startTime, endTime) as { is_outgoing: number; message_count: number }[];

                    let incomingCount = 0;
                    let outgoingCount = 0;

                    for (const row of results) {
                        if (row.is_outgoing === 1) {
                            outgoingCount = row.message_count;
                        } else {
                            incomingCount = row.message_count;
                        }
                    }

                    // Create date string for this period
                    const dateObj = new Date(endTime * 1000);
                    const dateStr = dateObj.toISOString().split('T')[0]!; // YYYY-MM-DD format

                    dailyVolumes.push({
                        timestamp: endTime,
                        date: dateStr,
                        messageCount: incomingCount + outgoingCount,
                        incomingCount,
                        outgoingCount
                    });
                }

                return reply.send(dailyVolumes);
            } catch (error) {
                return reply.code(404).send({ error: `Teleporter indexer not found for chain ${evmChainId}` });
            }
        });
    }
};

export default module;
