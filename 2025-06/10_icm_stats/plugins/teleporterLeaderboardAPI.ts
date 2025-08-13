import type { ApiPlugin } from "frostbyte-sdk";

const WELL_KNOWN_CHAINS: Record<string, string> = {
    '2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB': 'Henesys',
    '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5': 'C-Chain',
};

type LeaderboardEntry = {
    fromChain: string;
    toChain: string;
    fromName: string;
    toName: string;
    messageCount: number;
}

type ChainPairKey = `${string}->${string}`;

const module: ApiPlugin = {
    name: "teleporter_leaderboard",
    requiredIndexers: ["teleporter_messages"],

    registerRoutes: (app, dbCtx) => {
        // Helper function to get leaderboard data for a time period
        const getLeaderboard = (secondsAgo: number): LeaderboardEntry[] => {
            const configs = dbCtx.getAllChainConfigs();

            // Helper to get chainName by blockchainId, with special case for C_CHAIN_ID
            const chainNameById = new Map<string, string>();
            for (const config of configs) {
                chainNameById.set(config.blockchainId, config.chainName);
            }

            // Map to store aggregated counts, preferring incoming over outgoing
            const pairCounts = new Map<ChainPairKey, {
                fromChain: string;
                toChain: string;
                fromName: string;
                toName: string;
                incomingCount?: number;
                outgoingCount?: number;
            }>();

            // Query each chain's database
            for (const config of configs) {
                try {
                    const db = dbCtx.indexerDbFactory(config.evmChainId, "teleporter_messages");

                    // Get current timestamp in seconds
                    const now = Math.floor(Date.now() / 1000);
                    const startTime = now - secondsAgo;

                    // Query grouped counts for both incoming and outgoing messages
                    const results = db.prepare(`
                        SELECT 
                            is_outgoing,
                            other_chain_id,
                            COUNT(*) as message_count
                        FROM teleporter_messages
                        WHERE block_timestamp >= ?
                        GROUP BY is_outgoing, other_chain_id
                    `).all(startTime) as Array<{
                        is_outgoing: number;
                        other_chain_id: string;
                        message_count: number;
                    }>;

                    // Process results
                    for (const row of results) {
                        if (row.is_outgoing === 1) {
                            // Outgoing: from this chain to other chain
                            const key: ChainPairKey = `${config.blockchainId}->${row.other_chain_id}`;
                            const fromName = chainNameById.get(config.blockchainId) || WELL_KNOWN_CHAINS[config.blockchainId] || config.blockchainId;
                            const toName = chainNameById.get(row.other_chain_id) || WELL_KNOWN_CHAINS[row.other_chain_id] || row.other_chain_id;
                            const existing = pairCounts.get(key) || {
                                fromChain: config.blockchainId,
                                toChain: row.other_chain_id,
                                fromName,
                                toName
                            };
                            existing.outgoingCount = row.message_count;
                            pairCounts.set(key, existing);
                        } else {
                            // Incoming: from other chain to this chain
                            const key: ChainPairKey = `${row.other_chain_id}->${config.blockchainId}`;
                            const fromName = chainNameById.get(row.other_chain_id) || WELL_KNOWN_CHAINS[row.other_chain_id] || row.other_chain_id;
                            const toName = chainNameById.get(config.blockchainId) || WELL_KNOWN_CHAINS[config.blockchainId] || config.blockchainId;
                            const existing = pairCounts.get(key) || {
                                fromChain: row.other_chain_id,
                                toChain: config.blockchainId,
                                fromName,
                                toName
                            };
                            existing.incomingCount = row.message_count;
                            pairCounts.set(key, existing);
                        }
                    }
                } catch (error) {
                    // Chain might not have the teleporter_messages indexer
                    console.log(`Skipping chain ${config.chainName} - teleporter indexer not found`);
                }
            }

            // Convert to leaderboard entries, preferring incoming counts
            const leaderboard: LeaderboardEntry[] = [];
            for (const [_, data] of pairCounts) {
                leaderboard.push({
                    fromChain: data.fromChain,
                    toChain: data.toChain,
                    fromName: data.fromName,
                    toName: data.toName,
                    // Prefer incoming count over outgoing count
                    messageCount: data.incomingCount ?? data.outgoingCount ?? 0
                });
            }

            // Sort by message count descending
            leaderboard.sort((a, b) => b.messageCount - a.messageCount);

            return leaderboard;
        };

        // Day leaderboard endpoint
        app.get('/leaderboard/day', {
            schema: {
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                fromChain: { type: 'string' },
                                toChain: { type: 'string' },
                                fromName: { type: 'string' },
                                toName: { type: 'string' },
                                messageCount: { type: 'number' }
                            },
                            required: ['fromChain', 'toChain', 'fromName', 'toName', 'messageCount']
                        }
                    }
                }
            }
        }, (request, reply) => {
            const leaderboard = getLeaderboard(86400); // 24 hours
            return reply.send(leaderboard);
        });

        // Week leaderboard endpoint
        app.get('/leaderboard/week', {
            schema: {
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                fromChain: { type: 'string' },
                                toChain: { type: 'string' },
                                fromName: { type: 'string' },
                                toName: { type: 'string' },
                                messageCount: { type: 'number' }
                            },
                            required: ['fromChain', 'toChain', 'fromName', 'toName', 'messageCount']
                        }
                    }
                }
            }
        }, (request, reply) => {
            const leaderboard = getLeaderboard(604800); // 7 days
            return reply.send(leaderboard);
        });
    }
};

export default module;
