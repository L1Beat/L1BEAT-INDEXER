import type { ApiPlugin } from "frostbyte-sdk";

interface PeriodActiveAddressesResult {
    totalActiveAddresses: number;
    avgDailyActiveAddresses: number;
    totalTransactions: number;
}

interface DailyActiveCount {
    active_addresses: number;
    total_txs: number;
}

interface UniqueAddressCount {
    unique_addresses: number;
}

// Helper function to get available chains for dropdown
function getAvailableChains(dbCtx: any) {
    const chainConfigs = dbCtx.getAllChainConfigs();
    return {
        chainIds: chainConfigs.map((config: any) => config.evmChainId.toString()),
        chainOptionsWithNames: chainConfigs.map((config: any) => 
            `${config.evmChainId} (${config.chainName || 'Unknown'})`
        ),
        description: chainConfigs.map((config: any) => 
            `${config.evmChainId} (${config.chainName || 'Unknown'})`
        ).join(', ')
    };
}

const module: ApiPlugin = {
    name: "daily_active_addresses_api",
    requiredIndexers: ['daily_active_addresses'],

    registerRoutes: (app, dbCtx) => {
        const chainData = getAvailableChains(dbCtx);

        // Get active addresses for a period
        app.get<{
            Params: { evmChainId: string };
            Querystring: { startTimestamp: number; endTimestamp: number }
        }>('/api/:evmChainId/stats/active-addresses-period', {
            schema: {
                description: "Get active address statistics for a time period",
                tags: ["User Analytics"],
                params: {
                    type: 'object',
                    properties: {
                        evmChainId: { 
                            type: 'string',
                            enum: chainData.chainIds,
                            description: `EVM Chain ID. Available chains: ${chainData.description}`
                        }
                    },
                    required: ['evmChainId'],
                    additionalProperties: false
                },
                querystring: {
                    type: 'object',
                    properties: {
                        startTimestamp: { 
                            type: 'number', 
                            description: 'Start of period (Unix timestamp)' 
                        },
                        endTimestamp: { 
                            type: 'number', 
                            description: 'End of period (Unix timestamp)' 
                        }
                    },
                    required: ['startTimestamp', 'endTimestamp'],
                    additionalProperties: false
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            totalActiveAddresses: { 
                                type: 'number',
                                description: 'Total unique addresses that were active during the period'
                            },
                            avgDailyActiveAddresses: { 
                                type: 'number',
                                description: 'Average number of active addresses per day'
                            },
                            totalTransactions: { 
                                type: 'number',
                                description: 'Total transactions during the period'
                            }
                        },
                        required: ['totalActiveAddresses', 'avgDailyActiveAddresses', 'totalTransactions']
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
            // Parse chain ID directly (now expects clean chain ID like "16180")
            const evmChainIdStr = (request.params as { evmChainId: string }).evmChainId;
            const evmChainId = parseInt(evmChainIdStr);
            if (isNaN(evmChainId)) {
                return reply.code(400).send({ error: 'Invalid chain ID format' });
            }

            const { startTimestamp, endTimestamp } = request.query as { 
                startTimestamp: number; 
                endTimestamp: number; 
            };

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find((c: any) => c.evmChainId === evmChainId);
            if (!chainConfig) {
                return reply.code(404).send({ error: `Chain ${evmChainId} not found` });
            }

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'daily_active_addresses');

            // Round timestamps to day boundaries
            const startDay = Math.floor(startTimestamp / 86400) * 86400;
            const endDay = Math.floor(endTimestamp / 86400) * 86400;

            // Get unique addresses in period
            const uniqueStmt = indexerConn.prepare(`
                SELECT COUNT(DISTINCT address) as unique_addresses
                FROM daily_address_activity
                WHERE day_ts >= ? AND day_ts <= ?
            `);
            const uniqueResult = uniqueStmt.get(startDay, endDay) as UniqueAddressCount;

            // Get daily stats
            const dailyStmt = indexerConn.prepare(`
                SELECT active_addresses, total_txs
                FROM daily_active_counts
                WHERE day_ts >= ? AND day_ts <= ?
            `);
            const dailyResults = dailyStmt.all(startDay, endDay) as DailyActiveCount[];

            const totalDays = Math.ceil((endDay - startDay) / 86400) + 1;
            const sumActiveAddresses = dailyResults.reduce((sum, day) => sum + day.active_addresses, 0);
            const totalTransactions = dailyResults.reduce((sum, day) => sum + day.total_txs, 0);

            return reply.send({
                totalActiveAddresses: uniqueResult.unique_addresses || 0,
                avgDailyActiveAddresses: dailyResults.length > 0 ? sumActiveAddresses / dailyResults.length : 0,
                totalTransactions
            });
        });

        // Get daily active address counts
        app.get<{
            Params: { evmChainId: string };
            Querystring: { days?: number }
        }>('/api/:evmChainId/stats/daily-active-addresses', {
            schema: {
                description: "Get daily active address counts over time",
                tags: ["User Analytics"],
                params: {
                    type: 'object',
                    properties: {
                        evmChainId: { 
                            type: 'string',
                            enum: chainData.chainIds,
                            description: `EVM Chain ID. Available chains: ${chainData.description}`
                        }
                    },
                    required: ['evmChainId'],
                    additionalProperties: false
                },
                querystring: {
                    type: 'object',
                    properties: {
                        days: { 
                            type: 'number', 
                            minimum: 1, 
                            maximum: 365,
                            description: 'Number of days to retrieve (default: 30)'
                        }
                    },
                    additionalProperties: false
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                timestamp: { 
                                    type: 'number',
                                    description: 'Day timestamp (Unix timestamp at midnight UTC)'
                                },
                                activeAddresses: { 
                                    type: 'number',
                                    description: 'Number of unique active addresses on this day'
                                },
                                transactions: { 
                                    type: 'number',
                                    description: 'Total transactions on this day'
                                }
                            },
                            required: ['timestamp', 'activeAddresses', 'transactions']
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
            // Parse chain ID directly
            const evmChainIdStr = (request.params as { evmChainId: string }).evmChainId;
            const evmChainId = parseInt(evmChainIdStr);
            if (isNaN(evmChainId)) {
                return reply.code(400).send({ error: 'Invalid chain ID format' });
            }

            const { days = 30 } = request.query as { days?: number };

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find((c: any) => c.evmChainId === evmChainId);
            if (!chainConfig) {
                return reply.code(404).send({ error: `Chain ${evmChainId} not found` });
            }

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'daily_active_addresses');

            // Get current day (rounded down to midnight)
            const currentDay = Math.floor(Date.now() / 1000 / 86400) * 86400;
            const startDay = currentDay - (days - 1) * 86400;

            const stmt = indexerConn.prepare(`
                SELECT day_ts, active_addresses, total_txs
                FROM daily_active_counts
                WHERE day_ts >= ? AND day_ts <= ?
                ORDER BY day_ts DESC
            `);
            const results = stmt.all(startDay, currentDay) as Array<{
                day_ts: number;
                active_addresses: number;
                total_txs: number;
            }>;

            return reply.send(results.map(r => ({
                timestamp: r.day_ts,
                activeAddresses: r.active_addresses,
                transactions: r.total_txs
            })));
        });
    }
};

export default module;