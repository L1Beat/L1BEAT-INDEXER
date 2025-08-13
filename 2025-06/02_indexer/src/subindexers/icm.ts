import { OpenAPIHono } from "@hono/zod-openapi"
import { createRoute } from "@hono/zod-openapi"
import { IndexContext, Indexer, IndexerFactory } from '../types'
import { StoredBlock } from '../types'
import { incrementMetric, getMetrics } from "../system/metrics"
import { MetricsResponseSchema, LimitQuerySchema } from "../openapiSchemas"
import { z } from "@hono/zod-openapi"
import * as metrics from "../system/metrics"

const TELEPORTER_ADDRESS = "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf"
export const teleporterTopics = new Map<string, string>([
    ['0x1eac640109dc937d2a9f42735a05f794b39a5e3759d681951d671aabbce4b104', 'BlockchainIDInitialized'],
    ['0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8', 'SendCrossChainMessage'],
    ['0xd13a7935f29af029349bed0a2097455b91fd06190a30478c575db3f31e00bf57', 'ReceiptReceived'],
    ['0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34', 'ReceiveCrossChainMessage'],
    ['0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c', 'MessageExecuted'],
    ['0x4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985', 'MessageExecutionFailed']
]);

const FrequencyParamsSchema = z.object({
    frequency: metrics.Frequency.openapi({
        param: { name: 'frequency', in: 'path' },
        example: '1h',
        description: 'Frequency interval (1h, 1d, or 1w)'
    }),
})

const EventDestinationParamsSchema = z.object({
    destination: z.string().openapi({
        param: { name: 'destination', in: 'path' },
        example: '0x1234567890123456789012345678901234567890',
        description: 'Destination address'
    }),
})

const ICMEventsResponseSchema = z.record(z.string(), z.array(z.object({
    timestamp: z.number(),
    value: z.number()
}))).openapi({
    description: 'ICM event metrics by event type'
})

const ICMEventsByDestinationResponseSchema = z.record(
    z.string(),
    z.record(z.string(), z.array(z.object({
        timestamp: z.number(),
        value: z.number()
    })))
).openapi({
    description: 'ICM event metrics by event type and destination'
})

class IcmIndexer extends Indexer {
    protected _initialize = () => {
        // No initialization needed for ICM
    }

    protected _handleBlock = (block: StoredBlock) => {
        if (block.block.transactions.length !== Object.keys(block.receipts).length) {
            console.warn(`Block ${block.block.number} has ${block.block.transactions.length} transactions but ${Object.keys(block.receipts).length} receipts`)
            throw new Error(`Block ${parseInt(block.block.number)} has ${block.block.transactions.length} transactions but ${Object.keys(block.receipts).length} receipts`)
        }

        for (const tx of block.block.transactions) {
            const receipt = block.receipts[tx.hash]!
            for (const log of receipt.logs) {
                if (log.address === TELEPORTER_ADDRESS) {
                    const topic = log.topics[0]
                    const eventName = teleporterTopics.get(topic) || "Unknown"
                    // const messageId = log.topics[1]
                    const destination = log.topics[2]

                    incrementMetric(this.db, Number(block.block.timestamp), ['icmEvt', eventName], 1)
                    if (destination) {
                        incrementMetric(this.db, Number(block.block.timestamp), ['icmEvt', eventName, destination], 1)
                    }
                }
            }
        }
    }

    registerAPI = (app: OpenAPIHono) => {
        // Route 1: All ICM events by type
        const icmEventsRoute = createRoute({
            method: 'get',
            path: `/metrics/{frequency}/icm-events`,
            request: {
                params: FrequencyParamsSchema,
                query: LimitQuerySchema
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: ICMEventsResponseSchema,
                        },
                    },
                    description: 'ICM event metrics for all event types',
                },
                400: { description: 'Invalid arguments' },
            },
            tags: ['ICM Metrics'],
            summary: 'Get ICM event metrics for all event types',
            description: 'Returns ICM event count metrics for all event types at the specified frequency interval'
        })

        app.openapi(icmEventsRoute, (c) => {
            const { frequency } = c.req.valid('param')
            const { limit } = c.req.valid('query')

            const result: Record<string, any[]> = {}
            for (const eventName of teleporterTopics.values()) {
                result[eventName] = getMetrics(this.db, frequency, ['icmEvt', eventName], limit)
            }
            return c.json(result)
        })

        // Route 2: All ICM events by destination
        const icmEventsByDestinationRoute = createRoute({
            method: 'get',
            path: `/metrics/{frequency}/icm-events-by-destination`,
            request: {
                params: FrequencyParamsSchema,
                query: LimitQuerySchema
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: ICMEventsByDestinationResponseSchema,
                        },
                    },
                    description: 'ICM event metrics for all event types broken down by destination',
                },
                400: { description: 'Invalid arguments' },
            },
            tags: ['ICM Metrics'],
            summary: 'Get ICM event metrics by destination',
            description: 'Returns ICM event count metrics for all event types broken down by destination at the specified frequency interval'
        })

        app.openapi(icmEventsByDestinationRoute, (c) => {
            const { frequency } = c.req.valid('param')
            const { limit } = c.req.valid('query')

            // Get all unique destinations from the database
            const destinations = metrics.getUniqueDimensionValues(this.db, 3, {
                dimension1: 'icmEvt'
            })

            const result: Record<string, Record<string, any[]>> = {}
            for (const eventName of teleporterTopics.values()) {
                result[eventName] = {}
                for (const destination of destinations) {
                    result[eventName][destination] = getMetrics(this.db, frequency, ['icmEvt', eventName, destination], limit)
                }
            }
            return c.json(result)
        })
    }
}

export const createIcmIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new IcmIndexer(context, isWriter)
}
