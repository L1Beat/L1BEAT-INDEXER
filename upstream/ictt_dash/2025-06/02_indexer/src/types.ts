import { OpenAPIHono } from "@hono/zod-openapi"
import SQLite3 from "better-sqlite3"
import { SqliteBlockStore } from "./system/SqliteBlockStore"
import * as EVMTypes from "./evmTypes"

export interface IndexContext {
    chainId: string
    db: SQLite3.Database
    blockstore: SqliteBlockStore
}

export type IndexerFactory = (context: IndexContext, isWriter: boolean) => Indexer

export abstract class Indexer {
    protected readonly db: SQLite3.Database
    protected readonly blockstore: SqliteBlockStore
    private readonly isWriter: boolean

    constructor(context: IndexContext, isWriter: boolean = false) {
        this.db = context.db
        this.blockstore = context.blockstore
        this.isWriter = isWriter
    }

    initialize(): void {
        if (!this.isWriter) {
            throw new Error(`Cannot initialize indexer in reader mode`)
        }
        this._initialize()
    }

    handleBlock(block: StoredBlock): void {
        if (!this.isWriter) {
            throw new Error(`Cannot handle block in reader mode`)
        }
        this._handleBlock(block)
    }

    abstract registerAPI(app: OpenAPIHono): void
    protected abstract _initialize(): void
    protected abstract _handleBlock(block: StoredBlock): void
}

export interface StoredBlock {
    block: EVMTypes.Block
    receipts: Record<string, EVMTypes.Receipt>
}
