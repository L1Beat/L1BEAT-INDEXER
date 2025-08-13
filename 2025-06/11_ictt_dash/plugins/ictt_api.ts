import type { ApiPlugin } from "frostbyte-sdk";
import { WELL_KNOWN_CHAINS } from "./lib/WellKnownChains";


type TransferStats = {
    homeChainBlockchainId: string;
    homeChainName: string;
    remoteChainBlockchainId: string;
    remoteChainName: string;
    direction: 'in' | 'out';
    contractAddress: string;
    coinAddress: string;
    transferCount: number;
    transferCoinsTotal: number;
}

// Key for aggregating transfers: homeChain:remoteChain:direction:contractAddress:coinAddress
type TransferKey = `${string}:${string}:${string}:${string}:${string}`;

interface TokenMovementRow {
    block_timestamp: number;
    is_inbound: number;
    amount: number;
    pair_chain: string;
    contract_address: string;
    coin_address: string;
    tx_hash: string;
}

const module: ApiPlugin = {
    name: "ictt_api",
    requiredIndexers: ["ictt"],

    registerRoutes: (app, dbCtx) => {
        app.get('/api/global/ictt/transfers', {
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
                                homeChainBlockchainId: { type: 'string' },
                                homeChainName: { type: 'string' },
                                remoteChainBlockchainId: { type: 'string' },
                                remoteChainName: { type: 'string' },
                                direction: { type: 'string', enum: ['in', 'out'] },
                                contractAddress: { type: 'string' },
                                coinAddress: { type: 'string' },
                                transferCount: { type: 'number' },
                                transferCoinsTotal: { type: 'number' }
                            },
                            required: ['homeChainBlockchainId', 'homeChainName', 'remoteChainBlockchainId', 'remoteChainName', 'direction', 'contractAddress', 'coinAddress', 'transferCount', 'transferCoinsTotal']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const query = request.query as { startTs?: number; endTs?: number };

            // No default limits - if not set, query all data
            const startTs = query.startTs || 0;
            const endTs = query.endTs || Number.MAX_SAFE_INTEGER;

            const configs = dbCtx.getAllChainConfigs();

            // Helper to get chainName by blockchainId
            const chainNameById = new Map<string, string>();
            for (const config of configs) {
                chainNameById.set(config.blockchainId, config.chainName);
            }

            // Map to store aggregated transfer stats
            const transferStats = new Map<TransferKey, TransferStats>();

            // Query each chain's database
            for (const config of configs) {
                const indexerConn = dbCtx.getIndexerDbConnection(config.evmChainId, "ictt");

                // Query token movements joined with recognized homes to get coin address
                // Only include contracts that have at least one remote registered
                const stmt = indexerConn.prepare(`
                        SELECT 
                            tm.block_timestamp,
                            tm.is_inbound,
                            tm.amount,
                            tm.pair_chain,
                            tm.contract_address,
                            rth.coin_address
                        FROM token_movements tm
                        JOIN recognized_token_homes rth ON tm.contract_address = rth.contract_address
                        WHERE tm.block_timestamp >= ? AND tm.block_timestamp <= ?
                          AND rth.at_least_one_remote_registered = 1
                    `);
                const results = stmt.all(startTs, endTs) as TokenMovementRow[];

                // Process each row - the current chain is always the home chain
                for (const row of results) {
                    const homeChainId = config.blockchainId;
                    const remoteChainId = row.pair_chain;
                    const direction: 'in' | 'out' = row.is_inbound === 1 ? 'in' : 'out';

                    // Create unique key for this specific transfer pattern
                    const key: TransferKey = `${homeChainId}:${remoteChainId}:${direction}:${row.contract_address}:${row.coin_address}`;

                    const existing = transferStats.get(key);
                    if (existing) {
                        existing.transferCount++;
                        existing.transferCoinsTotal += row.amount;
                    } else {
                        const homeName = chainNameById.get(homeChainId) || WELL_KNOWN_CHAINS[homeChainId] || homeChainId;
                        const remoteName = chainNameById.get(remoteChainId) || WELL_KNOWN_CHAINS[remoteChainId] || remoteChainId;

                        transferStats.set(key, {
                            homeChainBlockchainId: homeChainId,
                            homeChainName: homeName,
                            remoteChainBlockchainId: remoteChainId,
                            remoteChainName: remoteName,
                            direction: direction,
                            contractAddress: row.contract_address,
                            coinAddress: row.coin_address,
                            transferCount: 1,
                            transferCoinsTotal: row.amount
                        });
                    }
                }
            }

            // Convert map values to array
            const results: TransferStats[] = Array.from(transferStats.values());

            // Sort by transferCount descending
            results.sort((a, b) => b.transferCount - a.transferCount);

            return reply.send(results);
        });

        // New endpoint for individual transfers list
        app.get('/api/global/ictt/transfers-list', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        startTs: { type: 'number' },
                        endTs: { type: 'number' },
                        homeChain: { type: 'string' },
                        remoteChain: { type: 'string' },
                        contractAddress: { type: 'string' },
                        coinAddress: { type: 'string' }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            transfers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        homeChainBlockchainId: { type: 'string' },
                                        homeChainName: { type: 'string' },
                                        remoteChainBlockchainId: { type: 'string' },
                                        remoteChainName: { type: 'string' },
                                        direction: { type: 'string', enum: ['in', 'out'] },
                                        contractAddress: { type: 'string' },
                                        coinAddress: { type: 'string' },
                                        amount: { type: 'number' },
                                        blockTimestamp: { type: 'number' },
                                        txHash: { type: 'string' }
                                    },
                                    required: ['homeChainBlockchainId', 'homeChainName', 'remoteChainBlockchainId', 'remoteChainName', 'direction', 'contractAddress', 'coinAddress', 'amount', 'blockTimestamp', 'txHash']
                                }
                            },
                            totalCount: { type: 'number' },
                            availableChains: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        blockchainId: { type: 'string' },
                                        chainName: { type: 'string' }
                                    },
                                    required: ['blockchainId', 'chainName']
                                }
                            }
                        },
                        required: ['transfers', 'totalCount', 'availableChains']
                    }
                }
            }
        }, async (request, reply) => {
            const query = request.query as {
                startTs?: number;
                endTs?: number;
                homeChain?: string;
                remoteChain?: string;
                contractAddress?: string;
                coinAddress?: string;
            };

            const startTs = query.startTs || 0;
            const endTs = query.endTs || Math.floor(Date.now() / 1000);

            const configs = dbCtx.getAllChainConfigs();

            // Helper to get chainName by blockchainId
            const chainNameById = new Map<string, string>();
            const availableChains: Array<{ blockchainId: string, chainName: string }> = [];
            for (const config of configs) {
                chainNameById.set(config.blockchainId, config.chainName);
                availableChains.push({
                    blockchainId: config.blockchainId,
                    chainName: config.chainName
                });
            }

            // Also add well-known chains
            for (const [blockchainId, chainName] of Object.entries(WELL_KNOWN_CHAINS)) {
                if (!chainNameById.has(blockchainId)) {
                    chainNameById.set(blockchainId, chainName);
                    availableChains.push({ blockchainId, chainName });
                }
            }

            interface TransferRecord {
                homeChainBlockchainId: string;
                homeChainName: string;
                remoteChainBlockchainId: string;
                remoteChainName: string;
                direction: 'in' | 'out';
                contractAddress: string;
                coinAddress: string;
                amount: number;
                blockTimestamp: number;
                txHash: string;
            }

            const allTransfers: TransferRecord[] = [];

            // Query each chain's database
            for (const config of configs) {
                // Skip if filtering by home chain and this isn't it
                if (query.homeChain && config.blockchainId !== query.homeChain) {
                    continue;
                }

                const indexerConn = dbCtx.getIndexerDbConnection(config.evmChainId, "ictt");

                // Build SQL query with filters
                let sql = `
                        SELECT 
                            tm.block_timestamp,
                            tm.is_inbound,
                            tm.amount,
                            tm.pair_chain,
                            tm.contract_address,
                            rth.coin_address,
                            tm.tx_hash
                        FROM token_movements tm
                        JOIN recognized_token_homes rth ON tm.contract_address = rth.contract_address
                        WHERE tm.block_timestamp >= ? AND tm.block_timestamp <= ?
                          AND rth.at_least_one_remote_registered = 1
                    `;

                const params: any[] = [startTs, endTs];

                if (query.remoteChain) {
                    sql += ' AND tm.pair_chain = ?';
                    params.push(query.remoteChain);
                }

                if (query.contractAddress) {
                    sql += ' AND tm.contract_address = ?';
                    params.push(query.contractAddress);
                }

                if (query.coinAddress) {
                    sql += ' AND rth.coin_address = ?';
                    params.push(query.coinAddress);
                }

                sql += ' ORDER BY tm.block_timestamp DESC';

                const stmt = indexerConn.prepare(sql);
                const results = stmt.all(...params) as TokenMovementRow[];

                // Process each row
                for (const row of results) {
                    const homeChainId = config.blockchainId;
                    const remoteChainId = row.pair_chain;
                    const direction: 'in' | 'out' = row.is_inbound === 1 ? 'in' : 'out';

                    const homeName = chainNameById.get(homeChainId) || WELL_KNOWN_CHAINS[homeChainId] || homeChainId;
                    const remoteName = chainNameById.get(remoteChainId) || WELL_KNOWN_CHAINS[remoteChainId] || remoteChainId;

                    allTransfers.push({
                        homeChainBlockchainId: homeChainId,
                        homeChainName: homeName,
                        remoteChainBlockchainId: remoteChainId,
                        remoteChainName: remoteName,
                        direction: direction,
                        contractAddress: row.contract_address,
                        coinAddress: row.coin_address,
                        amount: row.amount,
                        blockTimestamp: row.block_timestamp,
                        txHash: row.tx_hash
                    });
                }
            }

            // Sort by timestamp descending
            allTransfers.sort((a, b) => b.blockTimestamp - a.blockTimestamp);

            // Return first 100 transfers and total count
            const limitedTransfers = allTransfers.slice(0, 100);

            return reply.send({
                transfers: limitedTransfers,
                totalCount: allTransfers.length,
                availableChains: availableChains
            });
        });

        // TVL (Total Value Locked) endpoint
        app.get('/api/global/ictt/tvl', {
            schema: {
                querystring: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'number' }
                    }
                },
                response: {
                    200: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                homeChainBlockchainId: { type: 'string' },
                                homeChainName: { type: 'string' },
                                remoteChainBlockchainId: { type: 'string' },
                                remoteChainName: { type: 'string' },
                                contractAddress: { type: 'string' },
                                coinAddress: { type: 'string' },
                                tvl: { type: 'number' }
                            },
                            required: ['homeChainBlockchainId', 'homeChainName', 'remoteChainBlockchainId', 'remoteChainName', 'contractAddress', 'coinAddress', 'tvl']
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const query = request.query as { timestamp?: number };

            // If timestamp provided, use it as upper bound. Otherwise no filter.
            const endTs = query.timestamp || Number.MAX_SAFE_INTEGER;

            const configs = dbCtx.getAllChainConfigs();

            // Helper to get chainName by blockchainId
            const chainNameById = new Map<string, string>();
            for (const config of configs) {
                chainNameById.set(config.blockchainId, config.chainName);
            }

            type TVLKey = `${string}:${string}:${string}:${string}`;
            type TVLData = {
                homeChainBlockchainId: string;
                homeChainName: string;
                remoteChainBlockchainId: string;
                remoteChainName: string;
                contractAddress: string;
                coinAddress: string;
                outboundTotal: number;
                inboundTotal: number;
            };

            // Map to store aggregated TVL data
            const tvlMap = new Map<TVLKey, TVLData>();

            // Query each chain's database
            for (const config of configs) {
                const indexerConn = dbCtx.getIndexerDbConnection(config.evmChainId, "ictt");

                // Query to get sum of inbound and outbound transfers
                const stmt = indexerConn.prepare(`
                    SELECT 
                        tm.is_inbound,
                        tm.pair_chain,
                        tm.contract_address,
                        rth.coin_address,
                        SUM(tm.amount) as total_amount
                    FROM token_movements tm
                    JOIN recognized_token_homes rth ON tm.contract_address = rth.contract_address
                    WHERE tm.block_timestamp <= ?
                      AND rth.at_least_one_remote_registered = 1
                    GROUP BY tm.is_inbound, tm.pair_chain, tm.contract_address, rth.coin_address
                `);

                const results = stmt.all(endTs) as Array<{
                    is_inbound: number;
                    pair_chain: string;
                    contract_address: string;
                    coin_address: string;
                    total_amount: number;
                }>;

                // Process each aggregated row
                for (const row of results) {
                    const homeChainId = config.blockchainId;
                    const remoteChainId = row.pair_chain;
                    const key: TVLKey = `${homeChainId}:${remoteChainId}:${row.contract_address}:${row.coin_address}`;

                    let tvlData = tvlMap.get(key);
                    if (!tvlData) {
                        const homeName = chainNameById.get(homeChainId) || WELL_KNOWN_CHAINS[homeChainId] || homeChainId;
                        const remoteName = chainNameById.get(remoteChainId) || WELL_KNOWN_CHAINS[remoteChainId] || remoteChainId;

                        tvlData = {
                            homeChainBlockchainId: homeChainId,
                            homeChainName: homeName,
                            remoteChainBlockchainId: remoteChainId,
                            remoteChainName: remoteName,
                            contractAddress: row.contract_address,
                            coinAddress: row.coin_address,
                            outboundTotal: 0,
                            inboundTotal: 0
                        };
                        tvlMap.set(key, tvlData);
                    }

                    // is_inbound = 0 means outbound, is_inbound = 1 means inbound
                    if (row.is_inbound === 0) {
                        tvlData.outboundTotal += row.total_amount;
                    } else {
                        tvlData.inboundTotal += row.total_amount;
                    }
                }
            }

            // Calculate TVL and prepare results
            const results = Array.from(tvlMap.values()).map(data => ({
                homeChainBlockchainId: data.homeChainBlockchainId,
                homeChainName: data.homeChainName,
                remoteChainBlockchainId: data.remoteChainBlockchainId,
                remoteChainName: data.remoteChainName,
                contractAddress: data.contractAddress,
                coinAddress: data.coinAddress,
                tvl: data.outboundTotal - data.inboundTotal
            }));

            // Sort by absolute TVL value descending
            results.sort((a, b) => Math.abs(b.tvl) - Math.abs(a.tvl));

            return reply.send(results);
        });
    }
};

export default module;
