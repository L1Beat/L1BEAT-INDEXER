import type { ApiPlugin } from "frostbyte-sdk";

interface WindowDataPoint {
    fromTs: number;
    toTs: number;
    layerzero: number;
    icm: number;
}

interface ChainComparison {
    chainId: number;
    chainName: string;
    blockchainId: string;
    data: WindowDataPoint[];
}

interface ChainPairDataPoint {
    fromTs: number;
    toTs: number;
    count: number;
}

interface ChainPairStats {
    otherChainId: string; // For ICM: blockchain ID, for LayerZero: endpoint ID
    protocol: 'icm' | 'layerzero';
    data: ChainPairDataPoint[];
}

interface DetailedChainComparison {
    chainId: number;
    chainName: string;
    blockchainId: string;
    layerzeroTotal: number;
    icmTotal: number;
    chainPairs: {
        otherChainId: string;
        protocol: 'icm' | 'layerzero';
        inbound: number;
        outbound: number;
        total: number;
    }[];
}

interface ChainPairSummary {
    sourceChainId: number;
    sourceChainName: string;
    sourceBlockchainId: string;
    otherChainId: string; // blockchain ID for ICM, endpoint ID for LayerZero
    protocol: 'icm' | 'layerzero';
    inbound: number;
    outbound: number;
    total: number;
}

const module: ApiPlugin = {
    name: "messaging_comparison",
    requiredIndexers: ['layerzero_messages', 'teleporter_messages'],

    registerRoutes: (app, dbCtx) => {
        app.get<{
            Querystring: { count?: number }
        }>('/api/global/messaging/comparison', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        count: { type: 'number', minimum: 1, maximum: 24, default: 12 }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                chainId: { type: 'number' },
                                chainName: { type: 'string' },
                                blockchainId: { type: 'string' },
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            fromTs: { type: 'number' },
                                            toTs: { type: 'number' },
                                            layerzero: { type: 'number' },
                                            icm: { type: 'number' }
                                        },
                                        required: ['fromTs', 'toTs', 'layerzero', 'icm']
                                    }
                                }
                            },
                            required: ['chainId', 'chainName', 'blockchainId', 'data']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const configs = dbCtx.getAllChainConfigs();
            const results: ChainComparison[] = [];
            // Rolling 30d windows, last window is [now-30d, now]
            const now = Math.floor(Date.now() / 1000);
            const windowSeconds = 86400 * 30;
            const countRequested = typeof request.query.count === 'number' ? request.query.count : 12;
            const count = Math.max(1, Math.min(24, countRequested));

            // Build windows in chronological order
            const windows: Array<{ fromTs: number; toTs: number }> = [];
            let endTs = now;
            for (let i = 0; i < count; i++) {
                const fromTs = endTs - windowSeconds;
                windows.push({ fromTs, toTs: endTs });
                endTs = fromTs;
            }
            windows.reverse();

            for (const config of configs) {
                try {
                    const lzConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'layerzero_messages');
                    const tpConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'teleporter_messages');

                    // Quick check if either table has any data
                    const lzCheck = lzConn.prepare('SELECT 1 FROM layerzero_messages LIMIT 1').get();
                    const tpCheck = tpConn.prepare('SELECT 1 FROM teleporter_messages LIMIT 1').get();

                    if (!lzCheck && !tpCheck) continue;

                    // Prepare statements once
                    const lzCountStmt = lzConn.prepare(`
                        SELECT COUNT(*) as c FROM layerzero_messages 
                        WHERE block_timestamp > ? AND block_timestamp <= ?
                    `);
                    const tpCountStmt = tpConn.prepare(`
                        SELECT COUNT(*) as c FROM teleporter_messages 
                        WHERE block_timestamp > ? AND block_timestamp <= ?
                    `);

                    const data: WindowDataPoint[] = [];
                    for (const w of windows) {
                        const lzRow = lzCountStmt.get(w.fromTs, w.toTs) as { c: number } | undefined;
                        const tpRow = tpCountStmt.get(w.fromTs, w.toTs) as { c: number } | undefined;
                        const layerzero = lzRow?.c || 0;
                        const icm = tpRow?.c || 0;
                        if (layerzero === 0 && icm === 0) {
                            // keep zeros to preserve alignment across chains; we'll filter empty chains later
                        }
                        data.push({ fromTs: w.fromTs, toTs: w.toTs, layerzero, icm });
                    }

                    // Skip chains with no activity across all windows
                    const hasActivity = data.some(d => d.layerzero > 0 || d.icm > 0);
                    if (!hasActivity) continue;

                    results.push({
                        chainId: config.evmChainId,
                        chainName: config.chainName,
                        blockchainId: config.blockchainId,
                        data
                    });

                } catch (error) {
                    console.error(`Error processing chain ${config.chainName}:`, error);
                }
            }

            // Sort by transaction count (largest chains first)
            const sortedResults = results.map((result) => {
                const blocksDbHelper = dbCtx.getBlocksDbHelper(result.chainId);
                const txCount = blocksDbHelper.getTxCount();
                return { ...result, txCount };
            });

            sortedResults.sort((a, b) => b.txCount - a.txCount);

            // Remove txCount from final response
            const finalResults = sortedResults.map(({ txCount, ...result }) => result);

            return reply.send(finalResults);
        });

        // New detailed endpoint with chain pair breakdown
        app.get<{
            Querystring: { startTs?: number; endTs?: number }
        }>('/api/global/messaging/comparison/detailed', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        startTs: { type: 'number' },
                        endTs: { type: 'number' }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                chainId: { type: 'number' },
                                chainName: { type: 'string' },
                                blockchainId: { type: 'string' },
                                layerzeroTotal: { type: 'number' },
                                icmTotal: { type: 'number' },
                                chainPairs: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            otherChainId: { type: 'string' },
                                            protocol: { type: 'string', enum: ['icm', 'layerzero'] },
                                            inbound: { type: 'number' },
                                            outbound: { type: 'number' },
                                            total: { type: 'number' }
                                        },
                                        required: ['otherChainId', 'protocol', 'inbound', 'outbound', 'total']
                                    }
                                }
                            },
                            required: ['chainId', 'chainName', 'blockchainId', 'layerzeroTotal', 'icmTotal', 'chainPairs']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const configs = dbCtx.getAllChainConfigs();
            const results: DetailedChainComparison[] = [];

            // Default to 3 months of data ending now
            const now = Math.floor(Date.now() / 1000);
            const threeMonthsAgo = now - (90 * 86400);
            const startTs = request.query.startTs || threeMonthsAgo;
            const endTs = request.query.endTs || now;

            for (const config of configs) {
                try {
                    const lzConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'layerzero_messages');
                    const tpConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'teleporter_messages');

                    // Quick check if either table has any data
                    const lzCheck = lzConn.prepare('SELECT 1 FROM layerzero_messages LIMIT 1').get();
                    const tpCheck = tpConn.prepare('SELECT 1 FROM teleporter_messages LIMIT 1').get();

                    if (!lzCheck && !tpCheck) continue;

                    // Get total counts
                    const lzTotalRow = lzConn.prepare(`
                        SELECT COUNT(*) as c FROM layerzero_messages 
                        WHERE block_timestamp > ? AND block_timestamp <= ?
                    `).get(startTs, endTs) as { c: number } | undefined;

                    const tpTotalRow = tpConn.prepare(`
                        SELECT COUNT(*) as c FROM teleporter_messages 
                        WHERE block_timestamp > ? AND block_timestamp <= ?
                    `).get(startTs, endTs) as { c: number } | undefined;

                    const layerzeroTotal = lzTotalRow?.c || 0;
                    const icmTotal = tpTotalRow?.c || 0;

                    // Skip chains with no activity in this period
                    if (layerzeroTotal === 0 && icmTotal === 0) continue;

                    // Get chain pair breakdown
                    const chainPairs: DetailedChainComparison['chainPairs'] = [];

                    // LayerZero chain pairs
                    if (layerzeroTotal > 0) {
                        const lzStmt = lzConn.prepare(`
                            SELECT 
                                chain_id,
                                is_outgoing,
                                COUNT(*) as count
                            FROM layerzero_messages
                            WHERE block_timestamp > ? AND block_timestamp <= ?
                            GROUP BY chain_id, is_outgoing
                        `);

                        const lzRows = lzStmt.all(startTs, endTs) as Array<{
                            chain_id: number;
                            is_outgoing: number;
                            count: number;
                        }>;

                        // Aggregate by chain_id
                        const lzAggregated = new Map<string, { inbound: number; outbound: number }>();
                        for (const row of lzRows) {
                            const chainId = row.chain_id.toString();
                            const current = lzAggregated.get(chainId) || { inbound: 0, outbound: 0 };
                            if (row.is_outgoing) {
                                current.outbound += row.count;
                            } else {
                                current.inbound += row.count;
                            }
                            lzAggregated.set(chainId, current);
                        }

                        // Create chain pair entries
                        for (const [chainId, counts] of lzAggregated) {
                            chainPairs.push({
                                otherChainId: chainId,
                                protocol: 'layerzero',
                                inbound: counts.inbound,
                                outbound: counts.outbound,
                                total: counts.inbound + counts.outbound
                            });
                        }
                    }

                    // ICM/Teleporter chain pairs
                    if (icmTotal > 0) {
                        const tpStmt = tpConn.prepare(`
                            SELECT 
                                other_chain_id,
                                is_outgoing,
                                COUNT(*) as count
                            FROM teleporter_messages
                            WHERE block_timestamp > ? AND block_timestamp <= ?
                            GROUP BY other_chain_id, is_outgoing
                        `);

                        const tpRows = tpStmt.all(startTs, endTs) as Array<{
                            other_chain_id: string;
                            is_outgoing: number;
                            count: number;
                        }>;

                        // Aggregate by other_chain_id
                        const tpAggregated = new Map<string, { inbound: number; outbound: number }>();
                        for (const row of tpRows) {
                            const current = tpAggregated.get(row.other_chain_id) || { inbound: 0, outbound: 0 };
                            if (row.is_outgoing) {
                                current.outbound += row.count;
                            } else {
                                current.inbound += row.count;
                            }
                            tpAggregated.set(row.other_chain_id, current);
                        }

                        // Create chain pair entries
                        for (const [chainId, counts] of tpAggregated) {
                            chainPairs.push({
                                otherChainId: chainId,
                                protocol: 'icm',
                                inbound: counts.inbound,
                                outbound: counts.outbound,
                                total: counts.inbound + counts.outbound
                            });
                        }
                    }

                    // Sort chain pairs by total activity
                    chainPairs.sort((a, b) => b.total - a.total);

                    results.push({
                        chainId: config.evmChainId,
                        chainName: config.chainName,
                        blockchainId: config.blockchainId,
                        layerzeroTotal,
                        icmTotal,
                        chainPairs
                    });

                } catch (error) {
                    console.error(`Error processing chain ${config.chainName}:`, error);
                }
            }

            // Sort by transaction count (largest chains first)
            const sortedResults = results.map((result) => {
                const blocksDbHelper = dbCtx.getBlocksDbHelper(result.chainId);
                const txCount = blocksDbHelper.getTxCount();
                return { ...result, txCount };
            });

            sortedResults.sort((a, b) => b.txCount - a.txCount);

            // Remove txCount from final response
            const finalResults = sortedResults.map(({ txCount, ...result }) => result);

            return reply.send(finalResults);
        });

        // Chain pairs summary endpoint - shows all chain pairs with message counts
        app.get<{
            Querystring: { days?: number }
        }>('/api/global/messaging/chain-pairs', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        days: { type: 'number', minimum: 1, maximum: 365, default: 30 }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                sourceChainId: { type: 'number' },
                                sourceChainName: { type: 'string' },
                                sourceBlockchainId: { type: 'string' },
                                otherChainId: { type: 'string' },
                                protocol: { type: 'string', enum: ['icm', 'layerzero'] },
                                inbound: { type: 'number' },
                                outbound: { type: 'number' },
                                total: { type: 'number' }
                            },
                            required: ['sourceChainId', 'sourceChainName', 'sourceBlockchainId', 'otherChainId', 'protocol', 'inbound', 'outbound', 'total']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const configs = dbCtx.getAllChainConfigs();
            const results: ChainPairSummary[] = [];

            const now = Math.floor(Date.now() / 1000);
            const days = typeof request.query.days === 'number' ? request.query.days : 30;
            const fromTs = now - (days * 86400);
            const toTs = now;

            for (const config of configs) {
                try {
                    const lzConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'layerzero_messages');
                    const tpConn = dbCtx.getIndexerDbConnection(config.evmChainId, 'teleporter_messages');

                    // Quick check if either table has any data
                    const lzCheck = lzConn.prepare('SELECT 1 FROM layerzero_messages LIMIT 1').get();
                    const tpCheck = tpConn.prepare('SELECT 1 FROM teleporter_messages LIMIT 1').get();

                    if (!lzCheck && !tpCheck) continue;

                    // LayerZero chain pairs
                    if (lzCheck) {
                        const lzStmt = lzConn.prepare(`
                            SELECT 
                                chain_id,
                                is_outgoing,
                                COUNT(*) as count
                            FROM layerzero_messages
                            WHERE block_timestamp > ? AND block_timestamp <= ?
                            GROUP BY chain_id, is_outgoing
                        `);

                        const lzRows = lzStmt.all(fromTs, toTs) as Array<{
                            chain_id: number;
                            is_outgoing: number;
                            count: number;
                        }>;

                        // Aggregate by chain_id
                        const lzAggregated = new Map<string, { inbound: number; outbound: number }>();
                        for (const row of lzRows) {
                            const chainId = row.chain_id.toString();
                            const current = lzAggregated.get(chainId) || { inbound: 0, outbound: 0 };
                            if (row.is_outgoing) {
                                current.outbound += row.count;
                            } else {
                                current.inbound += row.count;
                            }
                            lzAggregated.set(chainId, current);
                        }

                        // Create summary entries
                        for (const [chainId, counts] of lzAggregated) {
                            results.push({
                                sourceChainId: config.evmChainId,
                                sourceChainName: config.chainName,
                                sourceBlockchainId: config.blockchainId,
                                otherChainId: chainId,
                                protocol: 'layerzero',
                                inbound: counts.inbound,
                                outbound: counts.outbound,
                                total: counts.inbound + counts.outbound
                            });
                        }
                    }

                    // ICM/Teleporter chain pairs
                    if (tpCheck) {
                        const tpStmt = tpConn.prepare(`
                            SELECT 
                                other_chain_id,
                                is_outgoing,
                                COUNT(*) as count
                            FROM teleporter_messages
                            WHERE block_timestamp > ? AND block_timestamp <= ?
                            GROUP BY other_chain_id, is_outgoing
                        `);

                        const tpRows = tpStmt.all(fromTs, toTs) as Array<{
                            other_chain_id: string;
                            is_outgoing: number;
                            count: number;
                        }>;

                        // Aggregate by other_chain_id
                        const tpAggregated = new Map<string, { inbound: number; outbound: number }>();
                        for (const row of tpRows) {
                            const current = tpAggregated.get(row.other_chain_id) || { inbound: 0, outbound: 0 };
                            if (row.is_outgoing) {
                                current.outbound += row.count;
                            } else {
                                current.inbound += row.count;
                            }
                            tpAggregated.set(row.other_chain_id, current);
                        }

                        // Create summary entries
                        for (const [chainId, counts] of tpAggregated) {
                            results.push({
                                sourceChainId: config.evmChainId,
                                sourceChainName: config.chainName,
                                sourceBlockchainId: config.blockchainId,
                                otherChainId: chainId,
                                protocol: 'icm',
                                inbound: counts.inbound,
                                outbound: counts.outbound,
                                total: counts.inbound + counts.outbound
                            });
                        }
                    }

                } catch (error) {
                    console.error(`Error processing chain ${config.chainName}:`, error);
                }
            }

            // Sort by total activity descending
            results.sort((a, b) => b.total - a.total);

            return reply.send(results);
        });
    }
};

export default module;
