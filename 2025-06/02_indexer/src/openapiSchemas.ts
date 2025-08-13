import { z } from "@hono/zod-openapi"


export const MetricsResponseSchema = z.array(z.object({
    timestamp: z.number().openapi({
        example: Math.round(new Date().getTime() / 1000),
        description: 'Unix timestamp in seconds'
    }),
    value: z.number().openapi({
        example: 123,
        description: 'Value of the metric'
    })
})).openapi('MetricsResponse')

export const StatusRecordSchema = z.object({
    chainId: z.string().openapi({
        description: 'Chain identifier',
        example: 'ethereum'
    }),
    lastUpdatedTimestamp: z.number().openapi({
        description: 'Timestamp of last update in milliseconds',
        example: 1704067200000
    }),
    lastProcessedBlock: z.number().openapi({
        description: 'Last processed block number',
        example: 18900000
    }),
    latestBlockNumber: z.number().openapi({
        description: 'Latest known block number',
        example: 18900100
    }),
    isAlive: z.boolean().openapi({
        description: 'Whether the indexer is currently alive (updated within last 60 seconds)',
        example: true
    }),
    progress: z.number().openapi({
        description: 'Indexing progress as percentage',
        example: 99.5
    })
}).openapi('StatusRecord')

export const StatusResponseSchema = z.record(z.string(), StatusRecordSchema).openapi('StatusResponse')

export const LimitQuerySchema = z.object({
    limit: z.string().optional().default('1').transform((val) => parseInt(val)).refine((val) => val >= 1 && val <= 100, {
        message: 'Limit must be between 1 and 100',
    }).openapi({
        param: {
            name: 'limit',
            in: 'query',
        },
        example: '10',
        description: 'Number of items to return (1-100, default: 10)',
    }),
})
