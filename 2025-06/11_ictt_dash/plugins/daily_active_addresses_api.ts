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

const module: ApiPlugin = {
    name: "daily_active_addresses_api",
    requiredIndexers: ['daily_active_addresses'],

    registerRoutes: (app, dbCtx) => {
        // Get active addresses for a period
        app.get<{
            Params: { evmChainId: string };
            Querystring: { startTimestamp: number; endTimestamp: number }
        }>('/api/:evmChainId/stats/active-addresses-period', {
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
                        startTimestamp: { type: 'number', description: 'Start of period (Unix timestamp)' },
                        endTimestamp: { type: 'number', description: 'End of period (Unix timestamp)' }
                    },
                    required: ['startTimestamp', 'endTimestamp']
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            totalActiveAddresses: { type: 'number' },
                            avgDailyActiveAddresses: { type: 'number' },
                            totalTransactions: { type: 'number' }
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
            const evmChainId = parseInt(request.params.evmChainId);
            const { startTimestamp, endTimestamp } = request.query;

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find(c => c.evmChainId === evmChainId);
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
                        days: { type: 'number', minimum: 1, maximum: 365, default: 30 }
                    },
                    required: []
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                timestamp: { type: 'number' },
                                activeAddresses: { type: 'number' },
                                transactions: { type: 'number' }
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
            const evmChainId = parseInt(request.params.evmChainId);
            const days = request.query.days || 30;

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find(c => c.evmChainId === evmChainId);
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
