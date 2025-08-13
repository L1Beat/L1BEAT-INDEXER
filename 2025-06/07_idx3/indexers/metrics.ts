import SQLite from "better-sqlite3";
import { BlockDB } from "../blockFetcher/BlockDB";
import { CreateIndexerFunction, Indexer } from "./types";
import { LazyTx } from "../blockFetcher/lazy/LazyTx";
import { LazyBlock } from "../blockFetcher/lazy/LazyBlock";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { LazyTraces, LazyTraceCall } from "../blockFetcher/lazy/LazyTrace";


// Define schemas for the metrics API
const MetricQuerySchema = z.object({
    startTimestamp: z.coerce.number().optional().openapi({
        example: 1640995200,
        description: 'Start timestamp for the query range'
    }),
    endTimestamp: z.coerce.number().optional().openapi({
        example: 1641081600,
        description: 'End timestamp for the query range'
    }),
    timeInterval: z.enum(['hour', 'day', 'week', 'month']).optional().default('hour').openapi({
        example: 'hour',
        description: 'Time interval for aggregation'
    }),
    pageSize: z.coerce.number().optional().default(10).openapi({
        example: 10,
        description: 'Number of results per page'
    }),
    pageToken: z.string().optional().openapi({
        example: '1641081600',
        description: 'Token for pagination'
    })
});

const MetricResultSchema = z.object({
    timestamp: z.number().openapi({
        example: 1640995200,
        description: 'Timestamp of the metric data point'
    }),
    value: z.number().openapi({
        example: 1000,
        description: 'Metric value'
    })
}).openapi('MetricResult');

const MetricResponseSchema = z.object({
    results: z.array(MetricResultSchema).openapi({
        description: 'Array of metric results'
    }),
    nextPageToken: z.string().optional().openapi({
        description: 'Token for fetching the next page'
    })
}).openapi('MetricResponse');

const TIME_INTERVAL_HOUR = 0
const TIME_INTERVAL_DAY = 1
const TIME_INTERVAL_WEEK = 2
const TIME_INTERVAL_MONTH = 3

const METRIC_txCount = 0
const METRIC_cumulativeContracts = 1
const METRIC_cumulativeTxCount = 2

// Define available metrics
const METRICS = {
    txCount: METRIC_txCount,
    cumulativeContracts: METRIC_cumulativeContracts,
    cumulativeTxCount: METRIC_cumulativeTxCount,
} as const;

interface MetricResult {
    timestamp: number;
    value: number;
}

function isCumulativeMetric(metricId: number): boolean {
    return metricId === METRIC_cumulativeContracts || metricId === METRIC_cumulativeTxCount;
}

class MetricsIndexer implements Indexer {
    private cumulativeContractCount = 0;
    private cumulativeTxCount = 0;

    constructor(private blocksDb: BlockDB, private indexingDb: SQLite.Database) { }

    initialize(): void {
        this.indexingDb.exec(`
            CREATE TABLE IF NOT EXISTS metrics (
                timeInterval INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                metric INTEGER NOT NULL,
                value INTEGER NOT NULL,
                PRIMARY KEY (timeInterval, timestamp, metric)
            ) WITHOUT ROWID
        `);

        // Initialize cumulative contract count from existing data
        const contractResult = this.indexingDb.prepare(`
            SELECT MAX(value) as maxValue 
            FROM metrics 
            WHERE metric = ? AND timeInterval = ?
        `).get(METRIC_cumulativeContracts, TIME_INTERVAL_DAY) as { maxValue: number | null };

        this.cumulativeContractCount = contractResult?.maxValue || 0;

        // Initialize cumulative tx count from existing data
        const txResult = this.indexingDb.prepare(`
            SELECT MAX(value) as maxValue 
            FROM metrics 
            WHERE metric = ? AND timeInterval = ?
        `).get(METRIC_cumulativeTxCount, TIME_INTERVAL_DAY) as { maxValue: number | null };

        this.cumulativeTxCount = txResult?.maxValue || 0;
    }

    indexBlock(block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined): void {
        const blockTimestamp = block.timestamp;
        const txCount = txs.length;

        // Update incremental metrics (txCount)
        this.updateIncrementalMetric(TIME_INTERVAL_HOUR, blockTimestamp, METRIC_txCount, txCount);
        this.updateIncrementalMetric(TIME_INTERVAL_DAY, blockTimestamp, METRIC_txCount, txCount);
        this.updateIncrementalMetric(TIME_INTERVAL_WEEK, blockTimestamp, METRIC_txCount, txCount);
        this.updateIncrementalMetric(TIME_INTERVAL_MONTH, blockTimestamp, METRIC_txCount, txCount);

        // Update cumulative transaction count
        this.cumulativeTxCount += txCount;

        // Update cumulative metrics (cumulativeTxCount) - all intervals
        this.updateCumulativeMetric(TIME_INTERVAL_HOUR, blockTimestamp, METRIC_cumulativeTxCount, this.cumulativeTxCount);
        this.updateCumulativeMetric(TIME_INTERVAL_DAY, blockTimestamp, METRIC_cumulativeTxCount, this.cumulativeTxCount);
        this.updateCumulativeMetric(TIME_INTERVAL_WEEK, blockTimestamp, METRIC_cumulativeTxCount, this.cumulativeTxCount);
        this.updateCumulativeMetric(TIME_INTERVAL_MONTH, blockTimestamp, METRIC_cumulativeTxCount, this.cumulativeTxCount);

        // Count contract deployments in this block
        const contractCount = this.countContractDeployments(txs, traces);
        this.cumulativeContractCount += contractCount;

        // Update cumulative metrics (cumulativeContracts) - only day interval supported
        this.updateCumulativeMetric(TIME_INTERVAL_DAY, blockTimestamp, METRIC_cumulativeContracts, this.cumulativeContractCount);
    }

    private countContractDeployments(txs: LazyTx[], traces: LazyTraces | undefined): number {
        if (!traces) {
            // Fallback to current method when traces are unavailable
            return txs.filter(tx => tx.contractAddress).length;
        }

        // Count CREATE, CREATE2, and CREATE3 calls from traces
        let contractCount = 0;
        for (const trace of traces.traces) {
            contractCount += this.countCreateCallsInTrace(trace.result);
        }
        return contractCount;
    }

    private countCreateCallsInTrace(call: LazyTraceCall): number {
        let count = 0;

        // Check if this call is a contract creation (CREATE, CREATE2)
        if (call.type === 'CREATE' || call.type === 'CREATE2') {
            count = 1;
        }

        // Recursively check nested calls
        if (call.calls) {
            for (const nestedCall of call.calls) {
                count += this.countCreateCallsInTrace(nestedCall);
            }
        }

        return count;
    }

    private updateIncrementalMetric(timeInterval: number, timestamp: number, metric: number, increment: number): void {
        const normalizedTimestamp = normalizeTimestamp(timestamp, timeInterval);

        this.indexingDb.prepare(`
            INSERT INTO metrics (timeInterval, timestamp, metric, value) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(timeInterval, timestamp, metric) 
            DO UPDATE SET value = value + ?
        `).run(timeInterval, normalizedTimestamp, metric, increment, increment);
    }

    private updateCumulativeMetric(timeInterval: number, timestamp: number, metric: number, totalValue: number): void {
        const normalizedTimestamp = normalizeTimestamp(timestamp, timeInterval);

        this.indexingDb.prepare(`
            INSERT INTO metrics (timeInterval, timestamp, metric, value) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(timeInterval, timestamp, metric) 
            DO UPDATE SET value = ?
        `).run(timeInterval, normalizedTimestamp, metric, totalValue, totalValue);
    }

    registerRoutes(app: OpenAPIHono): void {
        // Create a separate route for each metric
        for (const [metricName, metricId] of Object.entries(METRICS)) {
            this.createMetricRoute(app, metricName, metricId);
        }
    }

    private createMetricRoute(app: OpenAPIHono, metricName: string, metricId: number): void {
        const route = createRoute({
            method: 'get',
            path: `/metrics/${metricName}`,
            request: {
                query: MetricQuerySchema,
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: MetricResponseSchema
                        }
                    },
                    description: `${metricName} metric data`
                },
                400: {
                    description: 'Bad request (invalid parameters)'
                }
            },
            tags: ['Metrics'],
            summary: `Get ${metricName} data`,
            description: `Retrieve ${metricName} blockchain metric with optional filtering and pagination`
        });

        app.openapi(route, (c) => {
            const {
                startTimestamp,
                endTimestamp,
                timeInterval = 'hour',
                pageSize = 100,
                pageToken
            } = c.req.valid('query');

            // Map time interval to constant
            const timeIntervalId = this.getTimeIntervalId(timeInterval);
            if (timeIntervalId === -1) {
                return c.json({ error: `Invalid timeInterval: ${timeInterval}` }, 400);
            }

            // Validate pageSize
            const validPageSize = Math.min(Math.max(pageSize, 1), 2160);

            // Route to appropriate handler based on metric type
            if (isCumulativeMetric(metricId)) {
                return this.handleCumulativeMetricQuery(
                    c, metricId, timeIntervalId, startTimestamp, endTimestamp,
                    validPageSize, pageToken
                );
            } else {
                return this.handleIncrementalMetricQuery(
                    c, metricId, timeIntervalId, startTimestamp, endTimestamp,
                    validPageSize, pageToken
                );
            }
        });
    }

    private handleIncrementalMetricQuery(
        c: any, metricId: number, timeIntervalId: number,
        startTimestamp: number | undefined, endTimestamp: number | undefined,
        pageSize: number, pageToken: string | undefined
    ) {
        // Build query
        let query = `
            SELECT timestamp, value 
            FROM metrics 
            WHERE timeInterval = ? AND metric = ?
        `;
        const params: any[] = [timeIntervalId, metricId];

        if (startTimestamp) {
            query += ` AND timestamp >= ?`;
            params.push(startTimestamp);
        }

        if (endTimestamp) {
            query += ` AND timestamp <= ?`;
            params.push(endTimestamp);
        }

        if (pageToken) {
            query += ` AND timestamp < ?`;
            params.push(parseInt(pageToken));
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(pageSize + 1);

        const results = this.indexingDb.prepare(query).all(...params) as MetricResult[];

        // Check if there's a next page
        const hasNextPage = results.length > pageSize;
        if (hasNextPage) {
            results.pop();
        }

        // Backfill missing periods with zero values
        const backfilledResults = this.backfillIncrementalMetric(
            results, timeIntervalId, startTimestamp, endTimestamp
        );

        const response: any = {
            results: backfilledResults.slice(0, pageSize),
            nextPageToken: hasNextPage && backfilledResults.length > 0
                ? backfilledResults[Math.min(pageSize - 1, backfilledResults.length - 1)]!.timestamp.toString()
                : undefined
        };

        return c.json(response);
    }

    private handleCumulativeMetricQuery(
        c: any, metricId: number, timeIntervalId: number,
        startTimestamp: number | undefined, endTimestamp: number | undefined,
        pageSize: number, pageToken: string | undefined
    ) {
        // For cumulative metrics, we need to get the most recent value before the range
        // to properly backfill
        let baseQuery = `
            SELECT timestamp, value 
            FROM metrics 
            WHERE timeInterval = ? AND metric = ?
        `;
        const baseParams: any[] = [timeIntervalId, metricId];

        // Get the current timestamp to avoid future values
        const now = Math.floor(Date.now() / 1000);

        // First, get the most recent non-zero value that's not in the future
        const mostRecentResult = this.indexingDb.prepare(
            baseQuery + ` AND timestamp <= ? AND value > 0 ORDER BY timestamp DESC LIMIT 1`
        ).get(...baseParams, now) as MetricResult | undefined;

        const currentCumulativeValue = mostRecentResult?.value || 0;

        // Now build the main query
        let query = baseQuery;
        const params = [...baseParams];

        if (startTimestamp) {
            query += ` AND timestamp >= ?`;
            params.push(startTimestamp);
        }

        if (endTimestamp) {
            query += ` AND timestamp <= ?`;
            params.push(endTimestamp);
        }

        if (pageToken) {
            query += ` AND timestamp < ?`;
            params.push(parseInt(pageToken));
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(pageSize + 1);

        const results = this.indexingDb.prepare(query).all(...params) as MetricResult[];

        // Check if there's a next page
        const hasNextPage = results.length > pageSize;
        if (hasNextPage) {
            results.pop();
        }

        // Filter out any zero values for cumulative metrics and future timestamps
        const filteredResults = results.filter(r => r.value > 0 || r.timestamp <= now);

        // Backfill cumulative values
        const backfilledResults = this.backfillCumulativeMetric(
            filteredResults, timeIntervalId, currentCumulativeValue, startTimestamp, endTimestamp
        );

        const response: any = {
            results: backfilledResults.slice(0, pageSize),
            nextPageToken: hasNextPage && backfilledResults.length > 0
                ? backfilledResults[Math.min(pageSize - 1, backfilledResults.length - 1)]!.timestamp.toString()
                : undefined
        };

        return c.json(response);
    }

    private backfillIncrementalMetric(
        results: MetricResult[],
        timeInterval: number,
        startTimestamp?: number,
        endTimestamp?: number
    ): MetricResult[] {
        if (results.length === 0) return results;

        const backfilled: MetricResult[] = [];
        const resultMap = new Map(results.map(r => [r.timestamp, r.value]));

        const oldest = results[results.length - 1]!.timestamp;
        const newest = results[0]!.timestamp;

        const start = startTimestamp ? Math.max(startTimestamp, oldest) : oldest;
        const end = endTimestamp ? Math.min(endTimestamp, newest) : newest;

        let current = newest;
        while (current >= start) {
            const value = resultMap.get(current);
            backfilled.push({
                timestamp: current,
                value: value !== undefined ? value : 0
            });
            current = this.getPreviousTimestamp(current, timeInterval);
        }

        return backfilled;
    }

    private backfillCumulativeMetric(
        results: MetricResult[],
        timeInterval: number,
        currentCumulativeValue: number,
        startTimestamp?: number,
        endTimestamp?: number
    ): MetricResult[] {
        // If no results, create synthetic results based on current value
        if (results.length === 0 && currentCumulativeValue > 0) {
            // Generate timestamps for the requested range
            const now = Math.floor(Date.now() / 1000);
            const end = endTimestamp || now;
            const start = startTimestamp || end - (24 * 60 * 60); // Default to 1 day range

            const syntheticResults: MetricResult[] = [];
            let current = normalizeTimestamp(end, timeInterval);
            const normalizedStart = normalizeTimestamp(start, timeInterval);

            while (current >= normalizedStart) {
                syntheticResults.push({
                    timestamp: current,
                    value: currentCumulativeValue
                });
                current = this.getPreviousTimestamp(current, timeInterval);
            }

            return syntheticResults;
        }

        const backfilled: MetricResult[] = [];
        const resultMap = new Map(results.map(r => [r.timestamp, r.value]));

        const oldest = results[results.length - 1]!.timestamp;
        const newest = results[0]!.timestamp;

        const start = startTimestamp ? Math.max(startTimestamp, oldest) : oldest;
        const end = endTimestamp ? Math.min(endTimestamp, newest) : newest;

        // Find the first non-zero value in results, or use currentCumulativeValue
        let lastKnownValue = currentCumulativeValue;
        for (const result of results) {
            if (result.value > 0) {
                lastKnownValue = result.value;
                break;
            }
        }

        let current = newest;
        while (current >= start) {
            const value = resultMap.get(current);
            if (value !== undefined && value > 0) {
                // Found a real non-zero value
                lastKnownValue = value;
                backfilled.push({
                    timestamp: current,
                    value: value
                });
            } else {
                // For gaps or zero values, use the last known value
                backfilled.push({
                    timestamp: current,
                    value: lastKnownValue
                });
            }
            current = this.getPreviousTimestamp(current, timeInterval);
        }

        return backfilled;
    }

    private getTimeIntervalId(timeInterval: string): number {
        switch (timeInterval) {
            case 'hour': return TIME_INTERVAL_HOUR;
            case 'day': return TIME_INTERVAL_DAY;
            case 'week': return TIME_INTERVAL_WEEK;
            case 'month': return TIME_INTERVAL_MONTH;
            default: return -1;
        }
    }

    private getPreviousTimestamp(timestamp: number, timeInterval: number): number {
        const date = new Date(timestamp * 1000);

        switch (timeInterval) {
            case TIME_INTERVAL_HOUR:
                return timestamp - 3600;
            case TIME_INTERVAL_DAY:
                return timestamp - 86400;
            case TIME_INTERVAL_WEEK:
                return timestamp - 604800;
            case TIME_INTERVAL_MONTH:
                date.setUTCMonth(date.getUTCMonth() - 1);
                return Math.floor(date.getTime() / 1000);
            default:
                return timestamp;
        }
    }
}
export const createMetricsIndexer: CreateIndexerFunction = (blocksDb: BlockDB, indexingDb: SQLite.Database) => {
    return new MetricsIndexer(blocksDb, indexingDb);
}


function normalizeTimestamp(timestamp: number, timeInterval: number): number {
    const date = new Date(timestamp * 1000); // Convert to milliseconds for Date constructor

    switch (timeInterval) {
        case TIME_INTERVAL_HOUR:
            return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()) / 1000);

        case TIME_INTERVAL_DAY:
            return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000);

        case TIME_INTERVAL_WEEK:
            const dayOfWeek = date.getUTCDay();
            const daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
            const monday = new Date(date);
            monday.setUTCDate(date.getUTCDate() - daysToMonday);
            return Math.floor(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()) / 1000);

        case TIME_INTERVAL_MONTH:
            return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000);

        default:
            throw new Error(`Unknown time interval: ${timeInterval}`);
    }
}
