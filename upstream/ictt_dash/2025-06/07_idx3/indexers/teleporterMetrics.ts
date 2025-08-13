const TELEPORTER_ADDRESS = "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf"
export const teleporterTopics = new Map<string, string>([
    ['0x1eac640109dc937d2a9f42735a05f794b39a5e3759d681951d671aabbce4b104', 'BlockchainIDInitialized'],
    ['0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8', 'SendCrossChainMessage'],
    ['0xd13a7935f29af029349bed0a2097455b91fd06190a30478c575db3f31e00bf57', 'ReceiptReceived'],
    ['0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34', 'ReceiveCrossChainMessage'],
    ['0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c', 'MessageExecuted'],
    ['0x4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985', 'MessageExecutionFailed']
]);

import SQLite from "better-sqlite3";
import { BlockDB } from "../blockFetcher/BlockDB";
import { CreateIndexerFunction, Indexer } from "./types";
import { LazyTx } from "../blockFetcher/lazy/LazyTx";
import { LazyBlock } from "../blockFetcher/lazy/LazyBlock";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { LazyTraces, LazyTraceCall } from "../blockFetcher/lazy/LazyTrace";
import { lazyTxToReceipt, lazyTxToTx } from "../blockFetcher/lazy/LazyTx";

// Response schema for teleporter metrics
const TeleporterMetricResponseSchema = z.object({
    result: z.object({
        value: z.number()
    })
}).openapi('TeleporterMetricResponse');

// Topic IDs for the events we're tracking
const SEND_CROSS_CHAIN_MESSAGE_TOPIC = '0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8';
const RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC = '0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34';

class TeleporterMetricsIndexer implements Indexer {
    private sourceTxnCount = 0;
    private destinationTxnCount = 0;

    constructor(private blocksDb: BlockDB, private indexingDb: SQLite.Database) { }

    initialize(): void {
        // Create a simple table to store the counters
        this.indexingDb.exec(`
            CREATE TABLE IF NOT EXISTS teleporter_metrics (
                metric_name TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            )
        `);

        // Initialize counters from existing data
        const sourceResult = this.indexingDb.prepare(
            `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
        ).get('source_txn_count') as { value: number } | undefined;

        const destResult = this.indexingDb.prepare(
            `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
        ).get('destination_txn_count') as { value: number } | undefined;

        this.sourceTxnCount = sourceResult?.value || 0;
        this.destinationTxnCount = destResult?.value || 0;
    }

    indexBlock(block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined): void {
        // Count teleporter transactions in this block
        let changeToRecord = false;
        for (const tx of txs) {
            // Check logs for relevant events
            for (const log of tx.logs) {
                if (log.address.toLowerCase() !== TELEPORTER_ADDRESS.toLowerCase()) {
                    continue;
                }

                // Check the first topic (event signature)
                const eventTopic = log.topics[0];

                if (eventTopic === SEND_CROSS_CHAIN_MESSAGE_TOPIC) {
                    this.sourceTxnCount++;
                    changeToRecord = true;
                } else if (eventTopic === RECEIVE_CROSS_CHAIN_MESSAGE_TOPIC) {
                    this.destinationTxnCount++;
                    changeToRecord = true;
                }

            }
        }
        if (changeToRecord) {
            // Update the database with new counts
            this.indexingDb.prepare(`
            INSERT OR REPLACE INTO teleporter_metrics (metric_name, value) VALUES (?, ?)
        `).run('source_txn_count', this.sourceTxnCount);

            this.indexingDb.prepare(`
            INSERT OR REPLACE INTO teleporter_metrics (metric_name, value) VALUES (?, ?)
        `).run('destination_txn_count', this.destinationTxnCount);
        }
    }

    registerRoutes(app: OpenAPIHono): void {
        // Route for source transaction count
        const sourceRoute = createRoute({
            method: 'get',
            path: '/teleporterMetrics/teleporterSourceTxnCount',
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: TeleporterMetricResponseSchema
                        }
                    },
                    description: 'Teleporter source transaction count'
                }
            },
            tags: ['Teleporter Metrics'],
            summary: 'Get teleporter source transaction count',
            description: 'Returns the total count of SendCrossChainMessage events'
        });

        app.openapi(sourceRoute, (c) => {
            const result = this.indexingDb.prepare(
                `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
            ).get('source_txn_count') as { value: number } | undefined;

            const value = result?.value || 0;
            console.log('Source count from DB:', value);

            return c.json({
                result: {
                    value: value
                }
            });
        });

        // Route for destination transaction count
        const destRoute = createRoute({
            method: 'get',
            path: '/teleporterMetrics/teleporterDestinationTxnCount',
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: TeleporterMetricResponseSchema
                        }
                    },
                    description: 'Teleporter destination transaction count'
                }
            },
            tags: ['Teleporter Metrics'],
            summary: 'Get teleporter destination transaction count',
            description: 'Returns the total count of ReceiveCrossChainMessage events'
        });

        app.openapi(destRoute, (c) => {
            const result = this.indexingDb.prepare(
                `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
            ).get('destination_txn_count') as { value: number } | undefined;

            const value = result?.value || 0;
            console.log('Destination count from DB:', value);

            return c.json({
                result: {
                    value: value
                }
            });
        });

        // Route for total transaction count
        const totalRoute = createRoute({
            method: 'get',
            path: '/teleporterMetrics/teleporterTotalTxnCount',
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: TeleporterMetricResponseSchema
                        }
                    },
                    description: 'Teleporter total transaction count'
                }
            },
            tags: ['Teleporter Metrics'],
            summary: 'Get teleporter total transaction count',
            description: 'Returns the total count of all teleporter transactions (source + destination)'
        });

        app.openapi(totalRoute, (c) => {
            const sourceResult = this.indexingDb.prepare(
                `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
            ).get('source_txn_count') as { value: number } | undefined;

            const destResult = this.indexingDb.prepare(
                `SELECT value FROM teleporter_metrics WHERE metric_name = ?`
            ).get('destination_txn_count') as { value: number } | undefined;

            const sourceValue = sourceResult?.value || 0;
            const destValue = destResult?.value || 0;
            const totalValue = sourceValue + destValue;

            console.log('Total count - Source:', sourceValue, 'Destination:', destValue, 'Total:', totalValue);

            return c.json({
                result: {
                    value: totalValue
                }
            });
        });
    }
}

export const createTeleporterMetricsIndexer: CreateIndexerFunction = (blocksDb: BlockDB, indexingDb: SQLite.Database) => {
    return new TeleporterMetricsIndexer(blocksDb, indexingDb);
};
