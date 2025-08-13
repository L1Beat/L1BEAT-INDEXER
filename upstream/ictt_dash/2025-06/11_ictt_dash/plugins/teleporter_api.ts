import type { ApiPlugin } from "frostbyte-sdk";

const module: ApiPlugin = {
    name: "teleporter_api",
    requiredIndexers: ['teleporter_messages'],

    registerRoutes: (app, dbCtx) => {
        // Get total ICM messages for a chain at a specific timestamp
        app.get<{
            Params: { evmChainId: string };
            Querystring: { timestamp?: number }
        }>('/api/:evmChainId/stats/icm-messages-total', {
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
                        timestamp: { type: 'number', description: 'Unix timestamp to get cumulative messages at. If not provided, returns latest.' }
                    },
                    required: []
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            timestamp: { type: 'number', description: 'The timestamp for which the counts are valid' },
                            totalMessages: { type: 'number', description: 'Total number of ICM messages (incoming + outgoing) up to timestamp' },
                            totalOutgoing: { type: 'number', description: 'Total number of outgoing ICM messages up to timestamp' },
                            totalIncoming: { type: 'number', description: 'Total number of incoming ICM messages up to timestamp' }
                        },
                        required: ['timestamp', 'totalMessages', 'totalOutgoing', 'totalIncoming']
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
            const queryTimestamp = request.query.timestamp;

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find(c => c.evmChainId === evmChainId);
            if (!chainConfig) {
                return reply.code(404).send({ error: `Chain ${evmChainId} not found` });
            }

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'teleporter_messages');

            let stmt;
            let resultTimestamp: number;

            if (queryTimestamp) {
                // Get counts up to the specified timestamp
                stmt = indexerConn.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_outgoing = 1 THEN 1 ELSE 0 END) as outgoing,
                        SUM(CASE WHEN is_outgoing = 0 THEN 1 ELSE 0 END) as incoming
                    FROM teleporter_messages
                    WHERE block_timestamp <= ?
                `);
                resultTimestamp = queryTimestamp;
            } else {
                // Get latest counts
                stmt = indexerConn.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_outgoing = 1 THEN 1 ELSE 0 END) as outgoing,
                        SUM(CASE WHEN is_outgoing = 0 THEN 1 ELSE 0 END) as incoming
                    FROM teleporter_messages
                `);
                resultTimestamp = Math.floor(Date.now() / 1000);
            }

            const result = queryTimestamp
                ? stmt.get(queryTimestamp) as { total: number; outgoing: number; incoming: number } | undefined
                : stmt.get() as { total: number; outgoing: number; incoming: number } | undefined;

            if (!result) {
                return reply.send({
                    timestamp: resultTimestamp,
                    totalMessages: 0,
                    totalOutgoing: 0,
                    totalIncoming: 0
                });
            }

            return reply.send({
                timestamp: resultTimestamp,
                totalMessages: result.total || 0,
                totalOutgoing: result.outgoing || 0,
                totalIncoming: result.incoming || 0
            });
        });
    }
};

export default module;
