import { Indexer, IndexerFactory } from "./types";
import { createIcmIndexer } from "./subindexers/icm";
import { createTxCountIndexer } from "./subindexers/txCount";
import { IndexContext } from "./types";
import { createTxIndexer } from "./subindexers/tx";
import { createBlockIndexer } from "./subindexers/block";
import { createRpcIndexer } from "./subindexers/rpc";
import { SqliteBlockStore } from "./system/SqliteBlockStore";
import SQLite3 from "better-sqlite3";
import path from "path";
import fs from "fs";
import { OpenAPIHono } from "@hono/zod-openapi";
import { registerDocsRoutes } from "./apis/docs";
import { BatchRpc } from "./rpc/BatchRpc";
import { startIndexingLoop } from "./startIndexer";
import { initIndexerDb } from "./system/initDb";
import { createStatusIndexer } from "./subindexers/status";

// Extract common database setup
async function setupDatabases(dbFolder: string, chainId: string, readonly = false) {
    const indexDbPath = path.join(dbFolder, chainId, "indexer.sqlite")
    const blockStoreDbPath = path.join(dbFolder, chainId, "blockstore.sqlite")

    //Wait for the database to be created if it's readonly
    if (readonly && !fs.existsSync(indexDbPath)) {
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (fs.existsSync(indexDbPath)) {
                break
            }
        }
        if (!fs.existsSync(indexDbPath)) {
            throw new Error("Indexer database not found after waiting")
        }
    }

    fs.mkdirSync(path.join(dbFolder, chainId), { recursive: true })

    const indexDb = new SQLite3(indexDbPath, { readonly })
    const blockStoreDb = new SQLite3(blockStoreDbPath, { readonly })
    const blockStore = new SqliteBlockStore(blockStoreDb)
    blockStore.initialize()

    //initialize the database if it's not readonly
    if (!readonly) {
        initIndexerDb(indexDb)
    }

    return {
        indexDb,
        blockStore,
        context: {
            chainId,
            db: indexDb,
            blockstore: blockStore
        }
    }
}

const defaultIndexerFactories: IndexerFactory[] = [
    createTxCountIndexer,
    createTxIndexer,
    createBlockIndexer,
    createIcmIndexer,
    createStatusIndexer,
    createRpcIndexer,
]

type APIConfig = {
    dbFolder: string
    chainId: string
    extraIndexers?: IndexerFactory[]
}

export async function startAPIApp(config: APIConfig): Promise<OpenAPIHono> {
    const { dbFolder, chainId, extraIndexers = [] } = config
    const indexers = [...defaultIndexerFactories, ...extraIndexers]
    const { context, blockStore } = await setupDatabases(dbFolder, chainId)
    const indexerInstances = indexers.map(factory => factory(context, true))
    for (const indexer of indexerInstances) {
        indexer.initialize()
    }

    const apiApp = new OpenAPIHono()
    for (const indexer of indexerInstances) {
        indexer.registerAPI(apiApp)
    }
    registerDocsRoutes(apiApp)
    return apiApp
}

type RPCLimits = {
    requestBatchSize: number
    maxConcurrent: number
    rps: number
    blocksPerBatch: number
    enableBatchSizeGrowth: boolean
}


type BackendConfig = {
    rpcLimits: RPCLimits
    rpcUrl: string
    dbFolder: string
    chainId: string
    extraIndexers?: IndexerFactory[]
    deleteDb?: boolean
}

export async function startBackend(config: BackendConfig) {
    const { rpcLimits, rpcUrl, dbFolder, chainId, extraIndexers = [], deleteDb = false } = config


    const rpc = new BatchRpc({
        rpcUrl,
        batchSize: rpcLimits.requestBatchSize,
        maxConcurrent: rpcLimits.maxConcurrent,
        rps: rpcLimits.rps,
        enableBatchSizeGrowth: rpcLimits.enableBatchSizeGrowth,
    })


    if (deleteDb && fs.existsSync(path.join(dbFolder, chainId))) {
        deleteWildcard(path.join(dbFolder, chainId), "indexer.sqlite")
    }


    const blockchainIdVerification = await rpc.fetchBlockchainIDFromPrecompile()
    if (blockchainIdVerification !== chainId && blockchainIdVerification !== "45PJLL") {//45PJLL is zero bytes, meaning no precompile
        throw new Error(`Blockchain ID verification failed: ${blockchainIdVerification} !== ${chainId}`)
    }



    const indexers = [...defaultIndexerFactories, ...extraIndexers]
    const { context, blockStore } = await setupDatabases(dbFolder, chainId)
    const writers = indexers.map(factory => factory(context, true))


    // Initialize writers
    for (const writer of writers) {
        writer.initialize()
    }

    startIndexingLoop(context.db, writers, blockStore, rpc, rpcLimits.blocksPerBatch)
}


function deleteWildcard(folder: string, fileWildcard: string) {
    const files = fs.readdirSync(folder).filter(file => file.startsWith(fileWildcard))
    for (const file of files) {
        const filePath = path.join(folder, file)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    }
}
