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

// Helper function to get available chains for dropdown
function getAvailableChains(dbCtx: any) {
    const chainConfigs = dbCtx.getAllChainConfigs();
    return {
        chainIds: chainConfigs.map((config: any) => config.evmChainId.toString()),
        description: chainConfigs.map((config: any) => config.evmChainId.toString()).join(', ')
    };
}

const module: ApiPlugin = {
    name: "gas_usage_api",
    requiredIndexers: ['minute_tx_counter'],

    registerRoutes: (app, dbCtx) => {
        const chainData = getAvailableChains(dbCtx);

        // Get gas usage for a period
        app.get<{
            Params: { evmChainId: string };
            Querystring: { startTimestamp: number; endTimestamp: number }
        }>('/api/:evmChainId/stats/gas-usage-period', {
            schema: {
                description: "Get total and average daily gas usage for a time period",
                tags: ["Gas Analytics"],
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
                            totalGasUsed: { 
                                type: 'number',
                                description: 'Total gas consumed during the period'
                            },
                            avgDailyGasUsed: { 
                                type: 'number',
                                description: 'Average gas consumption per day'
                            }
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
            // Parse chain ID directly
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
            const totalGasUsed = Math.max(0, endGas - startGas);

            const periodDays = Math.ceil((endTimestamp - startTimestamp) / 86400);
            const avgDailyGasUsed = periodDays > 0 ? totalGasUsed / periodDays : 0;

            return reply.send({
                totalGasUsed,
                avgDailyGasUsed: Math.round(avgDailyGasUsed)
            });
        });

        // Get cumulative gas usage at a specific timestamp
        app.get<{
            Params: { evmChainId: string };
            Querystring: { timestamp?: number }
        }>('/api/:evmChainId/stats/cumulative-gas', {
            schema: {
                description: "Get cumulative gas usage at a specific timestamp",
                tags: ["Gas Analytics"],
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
                        timestamp: { 
                            type: 'number', 
                            description: 'Unix timestamp to get cumulative gas at. If not provided, returns latest.' 
                        }
                    },
                    additionalProperties: false
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            timestamp: { 
                                type: 'number',
                                description: 'Timestamp of the data point'
                            },
                            cumulativeGasUsed: { 
                                type: 'number',
                                description: 'Total cumulative gas used up to this timestamp'
                            }
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
            // Parse chain ID directly
            const evmChainIdStr = (request.params as { evmChainId: string }).evmChainId;
            const evmChainId = parseInt(evmChainIdStr);
            if (isNaN(evmChainId)) {
                return reply.code(400).send({ error: 'Invalid chain ID format' });
            }

            const queryTimestamp = (request.query as { timestamp?: number }).timestamp;

            // Validate chain exists
            const chainConfig = dbCtx.getAllChainConfigs().find((c: any) => c.evmChainId === evmChainId);
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
                description: "Get daily gas usage trends over time",
                tags: ["Gas Analytics"],
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
                                    description: 'Day timestamp (Unix timestamp)'
                                },
                                gasUsed: { 
                                    type: 'number',
                                    description: 'Total gas used on this day'
                                }
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
                    timestamp: periodStart, // Use period start for consistent labeling
                    gasUsed
                });
            }

            // Reverse to get chronological order (oldest first)
            return reply.send(results.reverse());
        });
    }
};

export default module;
