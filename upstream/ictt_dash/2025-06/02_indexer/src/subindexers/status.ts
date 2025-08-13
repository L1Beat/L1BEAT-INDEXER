import { OpenAPIHono, z, createRoute } from "@hono/zod-openapi"
import { IndexContext, Indexer, IndexerFactory } from "../types"
import { StoredBlock } from "../types"
import { getLastProcessedBlock, getLatestBlockNumber, getLastUpdatedTimestamp } from "../system/config"
import { getMetrics } from "../system/metrics"

const StatusResponseSchema = z.object({
    latestBlockNumber: z.number(),
    lastUpdatedTimestamp: z.number(),
    healthy: z.boolean(),
    lastProcessedBlock: z.number(),
    caughtUp: z.boolean(),
    totalTxCount: z.number()
}).openapi({
    description: 'System status information'
})

class StatusIndexer extends Indexer {
    protected _initialize = () => {
        // No initialization needed for status
    }

    protected _handleBlock = (block: StoredBlock) => {
        // Status indexer doesn't process blocks
    }

    registerAPI = (app: OpenAPIHono) => {
        const statusRoute = createRoute({
            method: 'get',
            path: `/status`,
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: StatusResponseSchema,
                        },
                    },
                    description: 'System status',
                },
            },
            tags: ['Status'],
            summary: 'Get system status',
            description: 'Returns current system status including block processing status and health indicators'
        })

        app.openapi(statusRoute, (c) => {
            const latestBlockNumber = getLatestBlockNumber(this.db)
            const lastProcessedBlock = getLastProcessedBlock(this.db)
            const lastUpdatedTimestamp = getLastUpdatedTimestamp(this.db)

            // Get all tx_count metrics and sum them up
            const txCountMetrics = getMetrics(this.db, 'total', ['tx_count'], 1000)
            const totalTxCount = txCountMetrics[0]?.value || 0

            const now = Math.floor(Date.now() / 1000)
            const healthy = (now - lastUpdatedTimestamp) < 60 // Less than 1 minute
            const caughtUp = (latestBlockNumber - lastProcessedBlock) < 3

            return c.json({
                latestBlockNumber,
                lastUpdatedTimestamp,
                healthy,
                lastProcessedBlock,
                caughtUp,
                totalTxCount
            })
        })
    }
}

export const createStatusIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new StatusIndexer(context, isWriter)
}
