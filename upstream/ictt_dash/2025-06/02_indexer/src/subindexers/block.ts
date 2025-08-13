import { OpenAPIHono, z, createRoute } from "@hono/zod-openapi"
import { IndexContext, Indexer, IndexerFactory } from "../types"
import { StoredBlock } from "../types"
import { BlockSchema, Block, ReceiptSchema } from "../evmTypes"
import { cacheStatement } from '../lib/statementCache'
import { SqliteBlockStore } from '../system/SqliteBlockStore'
import { getLastProcessedBlock } from '../system/config'
import SQLite3 from 'better-sqlite3'

const createBlockLookupTableSQL = `
CREATE TABLE IF NOT EXISTS block_lookup_table (
    hash BLOB NOT NULL,
    blockNumber INTEGER NOT NULL,
    PRIMARY KEY (hash, blockNumber)
) WITHOUT ROWID;
`

const STORE_HASH_BYTES = 5

function shortenHash(hash: string) {
    // Remove '0x' prefix if present
    const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash
    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(STORE_HASH_BYTES)
    for (let i = 0; i < STORE_HASH_BYTES; i++) {
        bytes[i] = parseInt(cleanHash.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

class BlockIndexer extends Indexer {
    protected _initialize = () => {
        this.db.exec(createBlockLookupTableSQL)
    }

    protected _handleBlock = (block: StoredBlock) => {
        this.db.prepare(`INSERT OR REPLACE INTO block_lookup_table (hash, blockNumber) VALUES (?, ?)`)
            .run(shortenHash(block.block.hash), Number(block.block.number))
    }

    registerAPI = (app: OpenAPIHono) => {
        const blockRoute = createRoute({
            method: 'get',
            path: `/blocks/{blockNumberOrHash}`,
            request: {
                params: z.object({
                    blockNumberOrHash: z.string(),
                })
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: BlockSchema,
                        },
                    },
                    description: 'Block details',
                },
                404: { description: 'Block not found' },
                400: { description: 'Invalid block identifier' },
            },
            tags: ['Blocks'],
            summary: 'Get block',
            description: 'Returns block details for the given block number, hash, or "latest" for the last processed block'
        })

        app.openapi(blockRoute, async (c) => {
            const { blockNumberOrHash } = c.req.valid('param')

            try {
                const block = await getBlock(this.db, this.blockstore, blockNumberOrHash)
                return c.json(block)
            } catch (error) {
                console.error(error)
                return c.json({ error: 'Block not found' }, 404)
            }
        })

        const blockWithReceiptsRoute = createRoute({
            method: 'get',
            path: `/blocks/{blockNumberOrHash}/withReceipts`,
            request: {
                params: z.object({
                    blockNumberOrHash: z.string(),
                })
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: z.object({
                                block: BlockSchema,
                                receipts: z.record(z.string(), ReceiptSchema)
                            }),
                        },
                    },
                    description: 'Block details with receipts',
                },
                404: { description: 'Block not found' },
                400: { description: 'Invalid block identifier' },
            },
            tags: ['Blocks'],
            summary: 'Get block with receipts',
            description: 'Returns block details with receipts for the given block number, hash, or "latest" for the last processed block'
        })

        app.openapi(blockWithReceiptsRoute, async (c) => {
            const { blockNumberOrHash } = c.req.valid('param')

            try {
                const storedBlock = await getStoredBlock(this.db, this.blockstore, blockNumberOrHash)
                return c.json(storedBlock)
            } catch (error) {
                console.error(error)
                return c.json({ error: 'Block not found' }, 404)
            }
        })
    }
}

export async function getBlock(db: SQLite3.Database, blockStore: SqliteBlockStore, blockId: string): Promise<Block> {
    const storedBlock = await getStoredBlock(db, blockStore, blockId)
    return storedBlock.block
}

export async function getStoredBlock(db: SQLite3.Database, blockStore: SqliteBlockStore, blockId: string): Promise<StoredBlock> {
    // Handle 'latest' keyword
    if (blockId === 'latest') {
        const lastProcessedBlockNumber = getLastProcessedBlock(db)
        const block = await blockStore.getBlock(lastProcessedBlockNumber)
        if (!block) {
            throw new Error(`Last processed block ${lastProcessedBlockNumber} not found`)
        }
        return block
    }

    // Check if blockId is a number
    const blockNumber = parseInt(blockId)
    if (!isNaN(blockNumber)) {
        // Direct lookup by block number
        const block = await blockStore.getBlock(blockNumber)
        if (!block) {
            throw new Error(`Block ${blockNumber} not found`)
        }
        return block
    }

    // Hash-based lookup
    if (!blockId.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error(`Invalid block identifier: ${blockId}`)
    }

    const stmt = cacheStatement(db, `SELECT blockNumber FROM block_lookup_table WHERE hash = ?`)
    const results = stmt.all(shortenHash(blockId)) as { blockNumber: number }[]

    if (results.length === 0) {
        throw new Error(`Block ${blockId} not found`)
    }

    // Search through all potential blocks to find the one with the full matching hash
    for (const result of results) {
        const block = await blockStore.getBlock(result.blockNumber)
        if (!block) {
            continue // Skip if block not found
        }

        if (block.block.hash === blockId) {
            return block
        }
    }

    throw new Error(`Block ${blockId} not found`)
}

export const createBlockIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new BlockIndexer(context, isWriter)
}
