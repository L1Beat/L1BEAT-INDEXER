import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { OpenAPIHono } from '@hono/zod-openapi';
import cluster from "cluster"
import { startBackend, startAPIApp } from "./index"
import dotenv from "dotenv"

dotenv.config()

function requireTextEnv(name: string): string {
    const value = process.env[name]

    if (!value) {
        throw new Error(`${name} must be set`)
    }
    return value
}

function optionalTextEnv(name: string): string | undefined {
    return process.env[name]
}

function requireIntEnv(name: string, defaultValue?: number): number {
    if (!process.env[name] && defaultValue === undefined) {
        throw new Error(`${name} must be set`)
    }
    const value = parseInt(process.env[name] || defaultValue?.toString() || "0")
    if (isNaN(value)) {
        throw new Error(`${name} must be set`)
    }
    return value
}

function trueIfExistsFlag(name: string): boolean {
    const value = process.env[name]
    if (!value) return false

    const lowerValue = value.toLowerCase()
    if (lowerValue === 'n' || lowerValue === 'no' || lowerValue === 'not' || lowerValue === 'false') {
        return false
    }

    return true
}

const isProduction = process.env.NODE_ENV !== "development"

async function runWriter() {
    console.log("Starting writer process...")

    const RPS = requireIntEnv("RPS", 10)

    await startBackend({
        rpcLimits: {
            requestBatchSize: requireIntEnv("REQUEST_BATCH_SIZE", 400),
            maxConcurrent: requireIntEnv("MAX_CONCURRENT", RPS),
            rps: RPS,
            blocksPerBatch: requireIntEnv("BLOCKS_PER_BATCH", 100),
            enableBatchSizeGrowth: trueIfExistsFlag("ENABLE_BATCH_SIZE_GROWTH")
        },
        rpcUrl: requireTextEnv("RPC_URL"),
        dbFolder: requireTextEnv("DATA_DIR"),
        chainId: requireTextEnv("CHAIN_ID"),
        deleteDb: !isProduction,
    })
}

async function runReader() {
    console.log("Starting reader process...")

    const apiApp = await startAPIApp({
        dbFolder: requireTextEnv("DATA_DIR"),
        chainId: requireTextEnv("CHAIN_ID")
    })

    const app = new OpenAPIHono()
    app.use(logger())
    app.use(cors())

    app.get('/', (c) => c.html(`<p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        API documentation is available at <a href="/api/docs">/api/docs</a>
    </p>`))

    app.route('/api', apiApp)

    console.log("Starting server... on http://localhost:3000")
    serve({ fetch: app.fetch, port: 3000 })
}

if (cluster.isPrimary) {
    // Fork 4 reader workers
    for (let i = 0; i < 4; i++) {
        cluster.fork()
    }
    await runWriter()
} else {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await runReader()
}
