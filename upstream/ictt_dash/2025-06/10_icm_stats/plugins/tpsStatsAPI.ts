import type { ApiPlugin } from "frostbyte-sdk";

type TpsStats = {
    name: string;
    blockchainId: string;
    evmChainId: number;
    txs: number;
    tps: number;
}

const module: ApiPlugin = {
    name: "tps_stats",
    requiredIndexers: ['minute_tx_counter'],

    registerRoutes: (app, dbCtx) => {
        app.get<{
            Querystring: { period?: '1d' | '7d' | '30d' | '1h' }
        }>('/stats/tps', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        period: { type: 'string', enum: ['1d', '7d', '30d', '1h'], default: '1d' }
                    },
                    required: []
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                blockchainId: { type: 'string' },
                                evmChainId: { type: 'number' },
                                txs: { type: 'number' },
                                tps: { type: 'number' }
                            },
                            required: ['blockchainId', 'evmChainId', 'txs', 'tps']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const configs = dbCtx.getAllChainConfigs();
            const results: TpsStats[] = [];

            // Get current timestamp in seconds
            const now = Math.floor(Date.now() / 1000);
            let periodSeconds = 86400; // default: 1 day
            const period = request.query.period || '1d';
            if (period === '7d') periodSeconds = 86400 * 7;
            else if (period === '30d') periodSeconds = 86400 * 30;
            else if (period === '1h') periodSeconds = 3600;
            const since = now - periodSeconds;

            for (const config of configs) {
                const db = dbCtx.indexerDbFactory(config.evmChainId, 'minute_tx_counter');

                // Query minute_tx_counts table for the selected period
                const stmt = db.prepare(`
                    SELECT SUM(tx_count) as total_txs
                    FROM minute_tx_counts
                    WHERE minute_ts >= ?
                `);

                const result = stmt.get(since) as { total_txs: number | null };

                const txCount = result.total_txs || 0;
                const tps = txCount / periodSeconds;

                results.push({
                    name: config.chainName,
                    blockchainId: config.blockchainId,
                    evmChainId: config.evmChainId,
                    txs: txCount,
                    tps: Number(tps.toFixed(6))
                });
            }

            // Sort by TPS descending
            results.sort((a, b) => b.tps - a.tps);

            return reply.send(results);
        });
    }
};

export default module;
