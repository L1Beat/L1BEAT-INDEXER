import type { ApiPlugin } from "frostbyte-sdk";

interface GasUsagePeriodResult {
    totalGasUsed: number;
    avgDailyGasUsed: number;
}

interface CumulativeGasResult {
    minute_ts: number;
    cumulative_gas_used: number;
}

interface MinuteGasSum {
    total_gas: number | null;
}

const module: ApiPlugin = {
    name: "gas_usage_api",
    requiredIndexers: ['minute_tx_counter'],

    registerRoutes: (app, dbCtx) => {
        // Get gas usage for a period
        app.get<{
            Params: { evmChainId: string };
            Querystring: { startTimestamp: number; endTimestamp: number }
        }>('/api/:evmChainId/stats/gas-usage-period', {
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
                            totalGasUsed: { type: 'number' },
                            avgDailyGasUsed: { type: 'number' }
                        },
                        required: ['totalGasUsed', 'avgDailyGasUsed']
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

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'minute_tx_counter');

            // Get cumulative gas at start and end of period
            const startStmt = indexerConn.prepare(`
                SELECT minute_ts, cumulative_gas_used
                FROM cumulative_tx_counts
                WHERE minute_ts <= ?
                ORDER BY minute_ts DESC
                LIMIT 1
            `);
            const endStmt = indexerConn.prepare(`
                SELECT minute_ts, cumulative_gas_used
                FROM cumulative_tx_counts
                WHERE minute_ts <= ?
                ORDER BY minute_ts DESC
                LIMIT 1
            `);

            const startResult = startStmt.get(startTimestamp) as CumulativeGasResult | undefined;
            const endResult = endStmt.get(endTimestamp) as CumulativeGasResult | undefined;

            const startGas = startResult?.cumulative_gas_used || 0;
            const endGas = endResult?.cumulative_gas_used || 0;
            const totalGasUsed = endGas - startGas;

            const periodDays = Math.ceil((endTimestamp - startTimestamp) / 86400);
            const avgDailyGasUsed = periodDays > 0 ? totalGasUsed / periodDays : 0;

            return reply.send({
                totalGasUsed,
                avgDailyGasUsed
            });
        });

        // Get cumulative gas usage at a specific timestamp
        app.get<{
            Params: { evmChainId: string };
            Querystring: { timestamp?: number }
        }>('/api/:evmChainId/stats/cumulative-gas', {
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
                        timestamp: { type: 'number', description: 'Unix timestamp to get cumulative gas at. If not provided, returns latest.' }
                    },
                    required: []
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            timestamp: { type: 'number' },
                            cumulativeGasUsed: { type: 'number' }
                        },
                        required: ['timestamp', 'cumulativeGasUsed']
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

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'minute_tx_counter');

            let result: CumulativeGasResult | undefined;

            if (queryTimestamp) {
                // Get cumulative gas at or before the specified timestamp
                const minuteTs = Math.floor(queryTimestamp / 60) * 60;
                const stmt = indexerConn.prepare(`
                    SELECT minute_ts, cumulative_gas_used
                    FROM cumulative_tx_counts
                    WHERE minute_ts <= ?
                    ORDER BY minute_ts DESC
                    LIMIT 1
                `);
                result = stmt.get(minuteTs) as CumulativeGasResult | undefined;
            } else {
                // Get the latest cumulative gas
                const stmt = indexerConn.prepare(`
                    SELECT minute_ts, cumulative_gas_used
                    FROM cumulative_tx_counts
                    ORDER BY minute_ts DESC
                    LIMIT 1
                `);
                result = stmt.get() as CumulativeGasResult | undefined;
            }

            if (!result) {
                return reply.send({
                    timestamp: queryTimestamp || Math.floor(Date.now() / 1000),
                    cumulativeGasUsed: 0
                });
            }

            return reply.send({
                timestamp: result.minute_ts,
                cumulativeGasUsed: result.cumulative_gas_used
            });
        });

        // Get daily gas usage statistics
        app.get<{
            Params: { evmChainId: string };
            Querystring: { days?: number }
        }>('/api/:evmChainId/stats/daily-gas', {
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
                                gasUsed: { type: 'number' }
                            },
                            required: ['timestamp', 'gasUsed']
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

            const indexerConn = dbCtx.getIndexerDbConnection(evmChainId, 'minute_tx_counter');
            const results: Array<{ timestamp: number; gasUsed: number }> = [];

            // Get current timestamp in seconds
            const now = Math.floor(Date.now() / 1000);
            const dayInSeconds = 86400;

            // Calculate data points for each day going back
            for (let i = 0; i < days; i++) {
                // Calculate the time range for this 24h period
                const periodEnd = now - (i * dayInSeconds);
                const periodStart = periodEnd - dayInSeconds;

                // Query minute_tx_counts table for this 24h period
                const stmt = indexerConn.prepare(`
                    SELECT SUM(gas_used) as total_gas
                    FROM minute_tx_counts
                    WHERE minute_ts >= ? AND minute_ts < ?
                `);
                const result = stmt.get(periodStart, periodEnd) as MinuteGasSum;

                const gasUsed = result.total_gas || 0;

                results.push({
                    timestamp: periodEnd,
                    gasUsed
                });
            }

            return reply.send(results);
        });
    }
};

export default module;
