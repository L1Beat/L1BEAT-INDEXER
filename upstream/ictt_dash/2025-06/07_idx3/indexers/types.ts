import { BlockDB } from "../blockFetcher/BlockDB";
import { LazyBlock } from "../blockFetcher/lazy/LazyBlock";
import { LazyTx } from "../blockFetcher/lazy/LazyTx";
import { OpenAPIHono } from "@hono/zod-openapi";
import SQLite from 'better-sqlite3';
import { LazyTraces } from "../blockFetcher/lazy/LazyTrace";

export interface Indexer {
    initialize(): void;
    indexBlock(block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined): void;
    registerRoutes(app: OpenAPIHono): void;
}

export type CreateIndexerFunction = (blocksDb: BlockDB, indexingDb: SQLite.Database) => Indexer;
