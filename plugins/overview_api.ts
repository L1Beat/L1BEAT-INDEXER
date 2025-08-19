import type { ApiPlugin } from "frostbyte-sdk";

interface TxSumResult {
    total_txs: number | null;
}

interface MinuteTxCount {
    minute_ts: number;
    tx_count: number;
}

interface DailyTxCount {
    day_ts: number;
    tx_count: number;
}

interface DailyTxDataPoint {
    date: string;
    [chainId: string]: number | string; // date is string, chain values are numbers
}

interface CacheEntry<T> {
    promise: Promise<T>;
    timestamp: number;
}

// Simple in-memory cache with 15s TTL
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 15 * 1000; // 15 seconds in milliseconds

function getCached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.promise;
    }

    // Create new promise and cache it immediately
    const promise = factory();
    cache.set(key, { promise, timestamp: now });

    return promise;
}

const module: ApiPlugin = {
    name: "overview_api",
    requiredIndexers: ['minute_tx_counter', 'period_address_activity', 'period_tx_counter', 'ictt', 'icm_gas_usage'],

    registerRoutes: (app, dbCtx) => {
        app.get('/api/global/overview/lastWeekTxs', {
            schema: {
                description: 'Get total transaction count across all L1s for the last 7 days',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            totalTxs: { type: 'number', description: 'Total transactions across all chains in the last week' }
                        },
                        required: ['totalTxs']
                    }
                }
            }
        }, async (request, reply) => {
            return getCached('lastWeekTxs', async () => {
                const configs = dbCtx.getAllChainConfigs();
                const now = Math.floor(Date.now() / 1000);
                const weekAgo = now - (7 * 24 * 60 * 60); // 7 days in seconds

                let totalTxs = 0;

                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "minute_tx_counter");

                    const result = conn.prepare(`
                        SELECT COALESCE(SUM(tx_count), 0) as total_txs
                        FROM minute_tx_counts
                        WHERE minute_ts >= ?
                    `).get(weekAgo) as TxSumResult;

                    totalTxs += result.total_txs || 0;
                }

                return { totalTxs };
            });
        });

        app.get('/api/global/overview/maxTpsObserved', {
            schema: {
                description: 'Get the maximum transactions per second observed across all L1s in the last 7 days',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            maxTps: { type: 'number', description: 'Maximum TPS observed (transactions per second)' },
                            timestamp: { type: 'number', description: 'Unix timestamp when max TPS occurred' },
                            totalTxsInMinute: { type: 'number', description: 'Total transactions in that peak minute' }
                        },
                        required: ['maxTps', 'timestamp', 'totalTxsInMinute']
                    }
                }
            }
        }, async (request, reply) => {
            return getCached('maxTpsObserved', async () => {
                const configs = dbCtx.getAllChainConfigs();
                const now = Math.floor(Date.now() / 1000);
                const weekAgo = now - (7 * 24 * 60 * 60); // 7 days in seconds

                // Map to accumulate tx counts by minute across all chains
                const minuteTotals = new Map<number, number>();

                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "minute_tx_counter");

                    // Get all non-zero minute intervals for this chain in the last 7 days
                    const minutes = conn.prepare(`
                            SELECT minute_ts, tx_count
                            FROM minute_tx_counts
                            WHERE minute_ts >= ? AND tx_count > 0
                        `).all(weekAgo) as MinuteTxCount[];

                    // Accumulate tx counts for each minute
                    for (const minute of minutes) {
                        const currentTotal = minuteTotals.get(minute.minute_ts) || 0;
                        minuteTotals.set(minute.minute_ts, currentTotal + minute.tx_count);
                    }
                }

                // Find the minute with maximum total transactions
                let maxMinuteTs = 0;
                let maxTxCount = 0;

                for (const [minuteTs, totalTxs] of minuteTotals) {
                    if (totalTxs > maxTxCount) {
                        maxTxCount = totalTxs;
                        maxMinuteTs = minuteTs;
                    }
                }

                // Convert to TPS (transactions per second)
                const maxTps = maxTxCount / 60;

                return {
                    maxTps,
                    timestamp: maxMinuteTs,
                    totalTxsInMinute: maxTxCount
                };
            });
        });

        app.get('/api/global/overview/lastWeekActiveAddresses', {
            schema: {
                description: 'Get unique active addresses count across all L1s for the last 7 days',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            uniqueAddresses: { type: 'number', description: 'Total unique addresses active across all chains in the last week' }
                        },
                        required: ['uniqueAddresses']
                    }
                }
            }
        }, async (request, reply) => {
            return getCached('lastWeekActiveAddresses', async () => {
                const configs = dbCtx.getAllChainConfigs();
                const now = Math.floor(Date.now() / 1000);
                const weekAgo = now - (7 * 24 * 60 * 60); // 7 days in seconds

                // Set to track unique addresses across all chains
                const uniqueAddresses = new Set<string>();

                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "period_address_activity");

                    // Get all unique addresses for this chain in the last 7 days
                    const addresses = conn.prepare(`
                        SELECT DISTINCT address
                        FROM period_address_activity
                        WHERE period_ts >= ?
                    `).all(weekAgo) as Array<{ address: string }>;

                    // Add to the global set
                    for (const row of addresses) {
                        uniqueAddresses.add(row.address);
                    }
                }

                return { uniqueAddresses: uniqueAddresses.size };
            });
        });

        app.get('/api/global/overview/dailyTxsByChain', {
            schema: {
                description: 'Get daily transaction counts by chain from January 2021 to present',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            data: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: true,
                                    description: 'Daily data point with date and per-chain transaction counts'
                                }
                            },
                            chains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        evmChainId: { type: 'number' },
                                        name: { type: 'string' }
                                    },
                                    required: ['evmChainId', 'name']
                                }
                            }
                        },
                        required: ['data', 'chains']
                    }
                }
            }
        }, async (request, reply) => {
            return getCached('dailyTxsByChain', async () => {
                const configs = dbCtx.getAllChainConfigs();

                // January 1st 2021 00:00:00 UTC
                const startDate = new Date('2021-01-01T00:00:00Z').getTime() / 1000;
                const now = Math.floor(Date.now() / 1000);
                const endDayTs = Math.floor(now / 86400) * 86400; // Round to start of current day

                // Map to store daily data: dayTs -> chainId -> txCount
                const dailyData = new Map<number, Map<number, number>>();

                // Collect data from all chains
                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "period_tx_counter");

                    // Get all daily counts for this chain since Jan 1 2021
                    const dailyCounts = conn.prepare(`
                        SELECT day_ts, tx_count
                        FROM daily_tx_counts
                        WHERE day_ts >= ?
                        ORDER BY day_ts ASC
                    `).all(startDate) as DailyTxCount[];

                    // Store in our map structure
                    for (const count of dailyCounts) {
                        if (!dailyData.has(count.day_ts)) {
                            dailyData.set(count.day_ts, new Map());
                        }
                        dailyData.get(count.day_ts)!.set(config.evmChainId, count.tx_count);
                    }
                }

                // Generate complete date range from Jan 1 2021 to today
                const dataPoints: DailyTxDataPoint[] = [];
                let currentDayTs = startDate;

                while (currentDayTs <= endDayTs) {
                    const dataPoint: DailyTxDataPoint = {
                        date: new Date(currentDayTs * 1000).toISOString().split('T')[0] // YYYY-MM-DD format
                    };

                    // Add tx counts for each chain
                    const dayData = dailyData.get(currentDayTs);
                    for (const config of configs) {
                        // Use chain ID as key, default to 0 if no data
                        dataPoint[`chain_${config.evmChainId}`] = dayData?.get(config.evmChainId) || 0;
                    }

                    dataPoints.push(dataPoint);
                    currentDayTs += 86400; // Move to next day
                }

                // Return data with chain metadata
                return {
                    data: dataPoints,
                    chains: configs.map(c => ({
                        evmChainId: c.evmChainId,
                        name: c.chainName
                    }))
                };
            });
        });

        // Helper function to get tx data for a given period
        async function getTxsByChainCompact(
            period: 'daily' | 'monthly',
            cacheKey: string,
            startDate: Date
        ) {
            return getCached(cacheKey, async () => {
                const configs = dbCtx.getAllChainConfigs();

                const startTs = startDate.getTime() / 1000;
                const now = Math.floor(Date.now() / 1000);

                let endTs: number;
                let dateFormatter: (ts: number) => string;

                if (period === 'daily') {
                    endTs = Math.floor(now / 86400) * 86400; // Round to start of current day
                    dateFormatter = (ts: number) => new Date(ts * 1000).toISOString().split('T')[0];
                } else {
                    // Round to start of current month
                    const currentDate = new Date(now * 1000);
                    currentDate.setUTCDate(1);
                    currentDate.setUTCHours(0, 0, 0, 0);
                    endTs = Math.floor(currentDate.getTime() / 1000);
                    dateFormatter = (ts: number) => {
                        const date = new Date(ts * 1000);
                        return date.toISOString().substring(0, 7); // YYYY-MM format
                    };
                }

                // Generate date labels
                const dates: string[] = [];
                if (period === 'daily') {
                    for (let ts = startTs; ts <= endTs; ts += 86400) { // 86400 = 1 day in seconds
                        dates.push(dateFormatter(ts));
                    }
                } else {
                    // For monthly, we need special handling
                    const currentDate = new Date(startTs * 1000);
                    while (currentDate.getTime() / 1000 <= endTs) {
                        dates.push(dateFormatter(currentDate.getTime() / 1000));
                        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
                    }
                }

                // Collect data from all chains
                const chains: Array<{
                    evmChainId: number;
                    name: string;
                    values: number[];
                }> = [];

                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "period_tx_counter");

                    // Get counts for this chain in the specified period
                    const query = period === 'daily'
                        ? `SELECT day_ts as ts, tx_count FROM daily_tx_counts WHERE day_ts >= ? AND day_ts <= ? ORDER BY day_ts ASC`
                        : `SELECT month_ts as ts, tx_count FROM monthly_tx_counts WHERE month_ts >= ? AND month_ts <= ? ORDER BY month_ts ASC`;

                    const counts = conn.prepare(query).all(startTs, endTs) as Array<{ ts: number; tx_count: number }>;

                    // Create a map for quick lookup
                    const countMap = new Map<string, number>();
                    for (const count of counts) {
                        countMap.set(dateFormatter(count.ts), count.tx_count);
                    }

                    // Build values array in same order as dates
                    const values: number[] = dates.map(date => countMap.get(date) || 0);

                    chains.push({
                        evmChainId: config.evmChainId,
                        name: config.chainName,
                        values
                    });
                }

                return { dates, chains };
            });
        }

        app.get('/api/global/overview/dailyTxsByChainCompact', {
            schema: {
                description: 'Get daily transaction counts by chain in compact format (arrays) since September 2020',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            dates: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of dates in YYYY-MM-DD format'
                            },
                            chains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        evmChainId: { type: 'number' },
                                        name: { type: 'string' },
                                        values: {
                                            type: 'array',
                                            items: { type: 'number' },
                                            description: 'Daily transaction counts corresponding to dates array'
                                        }
                                    },
                                    required: ['evmChainId', 'name', 'values']
                                }
                            }
                        },
                        required: ['dates', 'chains']
                    }
                }
            }
        }, async (request, reply) => {
            return getTxsByChainCompact(
                'daily',
                'dailyTxsByChainCompact',
                new Date('2020-09-23T00:00:00Z')
            );
        });

        app.get('/api/global/overview/monthlyTxsByChainCompact', {
            schema: {
                description: 'Get monthly transaction counts by chain in compact format (arrays) since September 2020',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            dates: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of months in YYYY-MM format'
                            },
                            chains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        evmChainId: { type: 'number' },
                                        name: { type: 'string' },
                                        values: {
                                            type: 'array',
                                            items: { type: 'number' },
                                            description: 'Monthly transaction counts corresponding to dates array'
                                        }
                                    },
                                    required: ['evmChainId', 'name', 'values']
                                }
                            }
                        },
                        required: ['dates', 'chains']
                    }
                }
            }
        }, async (request, reply) => {
            return getTxsByChainCompact(
                'monthly',
                'monthlyTxsByChainCompact',
                new Date('2020-09-01T00:00:00Z') // Start from September 2020
            );
        });

        app.get('/api/global/overview/monthlyICTTOperationsByChainCompact', {
            schema: {
                description: 'Get monthly ICTT cross-chain operations by chain in compact format since June 2024',
                tags: ['📊 L1Beat Overview'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            dates: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of months in YYYY-MM format'
                            },
                            chains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        evmChainId: { type: 'number' },
                                        name: { type: 'string' },
                                        values: {
                                            type: 'array',
                                            items: { type: 'number' },
                                            description: 'Monthly ICTT operation counts (inbound + outbound)'
                                        }
                                    },
                                    required: ['evmChainId', 'name', 'values']
                                }
                            }
                        },
                        required: ['dates', 'chains']
                    }
                }
            }
        }, async (request, reply) => {
            return getCached('monthlyICTTOperationsByChainCompact', async () => {
                const configs = dbCtx.getAllChainConfigs();

                // Map blockchain IDs to evmChainIds for pair_chain lookups
                const blockchainIdToEvmChainId = new Map<string, number>();
                for (const config of configs) {
                    blockchainIdToEvmChainId.set(config.blockchainId, config.evmChainId);
                }

                // June 1st 2024 00:00:00 UTC
                const startDate = new Date('2024-06-01T00:00:00Z');

                // Round to start of current month
                const now = Math.floor(Date.now() / 1000);
                const endDate = new Date(now * 1000);
                endDate.setUTCDate(1);
                endDate.setUTCHours(0, 0, 0, 0);

                // Generate month labels
                const dates: string[] = [];
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    dates.push(currentDate.toISOString().substring(0, 7)); // YYYY-MM format
                    currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
                }

                // Map to accumulate operation counts: chainId -> month -> count
                const operationCounts = new Map<number, Map<string, number>>();

                // Initialize map for all chains
                for (const config of configs) {
                    const monthMap = new Map<string, number>();
                    for (const date of dates) {
                        monthMap.set(date, 0);
                    }
                    operationCounts.set(config.evmChainId, monthMap);
                }

                // Collect data from all chains
                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "ictt");

                    // Query movements grouped by month and pair_chain
                    const movements = conn.prepare(`
                        SELECT 
                            strftime('%Y-%m', datetime(block_timestamp, 'unixepoch')) as month,
                            pair_chain,
                            COUNT(*) as movement_count
                        FROM token_movements
                        GROUP BY month, pair_chain
                    `).all() as Array<{ month: string; pair_chain: string; movement_count: number }>;

                    // Process movements
                    for (const movement of movements) {
                        if (!dates.includes(movement.month)) continue;

                        // Add to source chain (current chain)
                        const sourceChainCounts = operationCounts.get(config.evmChainId)!;
                        sourceChainCounts.set(
                            movement.month,
                            sourceChainCounts.get(movement.month)! + movement.movement_count
                        );

                        // Add to destination chain (pair_chain)
                        // pair_chain is a CB58-encoded blockchain ID
                        const pairChainId = blockchainIdToEvmChainId.get(movement.pair_chain);

                        // If found, add to destination chain counts
                        if (pairChainId && operationCounts.has(pairChainId)) {
                            const destChainCounts = operationCounts.get(pairChainId)!;
                            destChainCounts.set(
                                movement.month,
                                destChainCounts.get(movement.month)! + movement.movement_count
                            );
                        }
                    }
                }

                // Build result in compact format
                const chains: Array<{
                    evmChainId: number;
                    name: string;
                    values: number[];
                }> = [];

                for (const config of configs) {
                    const chainCounts = operationCounts.get(config.evmChainId)!;
                    const values = dates.map(date => chainCounts.get(date) || 0);

                    chains.push({
                        evmChainId: config.evmChainId,
                        name: config.chainName,
                        values
                    });
                }

                return { dates, chains };
            });
        });

        // Endpoint for monthly ICM messages by chain (incoming or outgoing)
        app.get('/api/global/overview/monthlyICM/:direction/byChainCompact', {
            schema: {
                description: 'Get monthly ICM message counts by direction (incoming/outgoing) and chain since June 2024',
                tags: ['📊 L1Beat Overview'],
                params: {
                    type: 'object',
                    properties: {
                        direction: { 
                            type: 'string', 
                            enum: ['incoming', 'outgoing'],
                            description: 'Message direction: incoming (received) or outgoing (sent)' 
                        }
                    },
                    required: ['direction']
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            dates: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of months in YYYY-MM format'
                            },
                            chains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        evmChainId: { type: 'number' },
                                        name: { type: 'string' },
                                        values: {
                                            type: 'array',
                                            items: { type: 'number' },
                                            description: 'Monthly ICM message counts for specified direction'
                                        }
                                    },
                                    required: ['evmChainId', 'name', 'values']
                                }
                            }
                        },
                        required: ['dates', 'chains']
                    }
                }
            }
        }, async (request, reply) => {
            const { direction } = request.params as { direction: 'incoming' | 'outgoing' };
            const cacheKey = `monthlyICM_${direction}_byChainCompact`;

            return getCached(cacheKey, async () => {
                const configs = dbCtx.getAllChainConfigs();

                // Map blockchain IDs to evmChainIds
                const blockchainIdToEvmChainId = new Map<string, number>();
                for (const config of configs) {
                    blockchainIdToEvmChainId.set(config.blockchainId, config.evmChainId);
                }

                // June 1st 2024 00:00:00 UTC
                const startDate = new Date('2024-06-01T00:00:00Z');

                // Round to start of current month
                const now = Math.floor(Date.now() / 1000);
                const endDate = new Date(now * 1000);
                endDate.setUTCDate(1);
                endDate.setUTCHours(0, 0, 0, 0);

                // Generate month labels
                const dates: string[] = [];
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    dates.push(currentDate.toISOString().substring(0, 7)); // YYYY-MM format
                    currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
                }

                // Map to accumulate message counts: chainId -> month -> count
                const messageCounts = new Map<number, Map<string, number>>();

                // Initialize map for all chains
                for (const config of configs) {
                    const monthMap = new Map<string, number>();
                    for (const date of dates) {
                        monthMap.set(date, 0);
                    }
                    messageCounts.set(config.evmChainId, monthMap);
                }

                // Collect data from all chains
                for (const config of configs) {
                    const conn = dbCtx.getIndexerDbConnection(config.evmChainId, "icm_gas_usage");

                    // Query ICM stats grouped by month and other_chain_id
                    const countColumn = direction === 'incoming' ? 'receive_count' : 'send_count';
                    const stats = conn.prepare(`
                        SELECT 
                            strftime('%Y-%m', datetime(interval_ts, 'unixepoch')) as month,
                            other_chain_id,
                            SUM(${countColumn}) as message_count
                        FROM icm_chain_interval_stats
                        WHERE ${countColumn} > 0
                        GROUP BY month, other_chain_id
                    `).all() as Array<{ month: string; other_chain_id: string; message_count: number }>;

                    // Process stats
                    for (const stat of stats) {
                        if (!dates.includes(stat.month)) continue;

                        // Add to current chain's counts
                        const chainCounts = messageCounts.get(config.evmChainId)!;
                        chainCounts.set(
                            stat.month,
                            chainCounts.get(stat.month)! + stat.message_count
                        );
                    }
                }

                // Build result in compact format
                const chains: Array<{
                    evmChainId: number;
                    name: string;
                    values: number[];
                }> = [];

                for (const config of configs) {
                    const chainCounts = messageCounts.get(config.evmChainId)!;
                    const values = dates.map(date => chainCounts.get(date) || 0);

                    chains.push({
                        evmChainId: config.evmChainId,
                        name: config.chainName,
                        values
                    });
                }

                return { dates, chains };
            });
        });
    }
};

export default module;