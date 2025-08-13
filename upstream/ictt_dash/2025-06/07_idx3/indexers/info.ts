import { LazyBlock } from "../blockFetcher/lazy/LazyBlock";
import { LazyTx } from "../blockFetcher/lazy/LazyTx";
import { LazyTraces } from "../blockFetcher/lazy/LazyTrace";
import { CreateIndexerFunction, Indexer } from "./types";
import { BlockDB } from "../blockFetcher/BlockDB";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import SQLite from "better-sqlite3";
import { CHAIN_ID } from "../config";

// Response schema for info
const InfoResponseSchema = z.object({
    evmId: z.number(),
    chainId: z.string(),
    isDebugEnabled: z.boolean(),
    totalBlocksInChain: z.number(),
    latestStoredBlock: z.number()
}).openapi('InfoResponse');

class InfoIndexer implements Indexer {
    constructor(private blocksDb: BlockDB, private indexingDb: SQLite.Database) { }

    initialize(): void {
        // No initialization needed - all data is already available
    }

    indexBlock(block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined): void {
        // No indexing needed - all data is already available
    }

    registerRoutes(app: OpenAPIHono): void {
        const infoRoute = createRoute({
            method: 'get',
            path: '/info',
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: InfoResponseSchema
                        }
                    },
                    description: 'Chain information'
                }
            },
            tags: ['Info'],
            summary: 'Get chain information',
            description: 'Returns EVM ID, chain ID, debug status, total blocks in chain, and stored blocks count'
        });

        app.openapi(infoRoute, (c) => {
            const evmId = this.blocksDb.getEvmChainId();
            const isDebugEnabled = this.blocksDb.getHasDebug() === 1;
            const totalBlocksInChain = this.blocksDb.getBlockchainLatestBlockNum();
            const latestStoredBlock = this.blocksDb.getLastStoredBlockNumber();

            return c.json({
                evmId,
                chainId: CHAIN_ID,
                isDebugEnabled,
                totalBlocksInChain,
                latestStoredBlock
            });
        });
    }
}

export const createInfoIndexer: CreateIndexerFunction = (blocksDb: BlockDB, indexingDb: SQLite.Database) => {
    return new InfoIndexer(blocksDb, indexingDb);
};
