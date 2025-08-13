import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { IndexContext, Indexer, IndexerFactory, StoredBlock } from "../types";
import { MetricsResponseSchema } from "../openapiSchemas";
import { LimitQuerySchema } from "../openapiSchemas";
import { z } from "@hono/zod-openapi";
import * as metrics from "../system/metrics";
import { getMetrics, incrementMetric } from "../system/metrics";

const FrequencyParamsSchema = z.object({
    frequency: metrics.Frequency.openapi({
        param: { name: 'frequency', in: 'path' },
        example: '1h',
        description: 'Frequency interval (1h, 1d, or 1w)'
    }),
})

class TxCountIndexer extends Indexer {
    protected _initialize = () => {
        // No initialization needed for tx count
    }

    protected _handleBlock = (block: StoredBlock) => {
        const txCount = block.block.transactions.length
        const timestamp = Number(block.block.timestamp)
        incrementMetric(this.db, timestamp, ['tx_count'], txCount)
    }

    registerAPI = (app: OpenAPIHono) => {
        const txCountRoute = createRoute({
            method: 'get',
            path: `/metrics/{frequency}/tx-count`,
            request: {
                params: FrequencyParamsSchema,
                query: LimitQuerySchema
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: MetricsResponseSchema,
                        },
                    },
                    description: 'Transaction count metrics for this chain',
                },
                400: { description: 'Invalid arguments' },
            },
            tags: ['Metrics'],
            summary: 'Get transaction count metrics',
            description: 'Returns transaction count metrics at the specified frequency interval'
        })

        app.openapi(txCountRoute, (c) => {
            const { frequency } = c.req.valid('param')
            const { limit } = c.req.valid('query')

            const txCountMetrics = getMetrics(this.db, frequency, ['tx_count'], limit)
            return c.json(txCountMetrics)
        })
    }
}

export const createTxCountIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new TxCountIndexer(context, isWriter)
}
