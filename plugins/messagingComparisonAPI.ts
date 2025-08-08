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
    }
};

export default module;
