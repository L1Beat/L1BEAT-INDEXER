//ponters to 

import SQLite3 from 'better-sqlite3'
import { OpenAPIHono, z, createRoute } from "@hono/zod-openapi"
import { cacheStatement } from '../lib/statementCache'
import { IndexContext, Indexer, IndexerFactory } from '../types'
import { StoredBlock } from '../types'
import { SqliteBlockStore } from '../system/SqliteBlockStore'
import { TransactionSchema, Transaction, Receipt, ReceiptSchema } from '../evmTypes'

const createTxLookupTableSQL = `
CREATE TABLE IF NOT EXISTS tx_lookup_table (
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

class TxIndexer extends Indexer {
    protected _initialize = () => {
        this.db.exec(createTxLookupTableSQL)
    }

    protected _handleBlock = (block: StoredBlock) => {
        for (const tx of block.block.transactions) {
            this.db.prepare(`INSERT OR REPLACE INTO tx_lookup_table (hash, blockNumber) VALUES (?, ?)`)
                .run(shortenHash(tx.hash), Number(block.block.number))
        }
    }

    registerAPI = (app: OpenAPIHono) => {
        const txRoute = createRoute({
            method: 'get',
            path: `/tx/{txId}`,
            request: {
                params: z.object({
                    txId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid transaction hash'),
                })
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: TransactionSchema,
                        },
                    },
                    description: 'Transaction details',
                },
                404: { description: 'Transaction not found' },
                400: { description: 'Invalid transaction hash' },
            },
            tags: ['Transactions'],
            summary: 'Get transaction by hash',
            description: 'Returns transaction details for the given transaction hash'
        })

        app.openapi(txRoute, async (c) => {
            const { txId } = c.req.valid('param')

            try {
                const tx = await getTx(this.db, this.blockstore, txId)
                return c.json(tx)
            } catch (error) {
                console.error(error)
                return c.json({ error: 'Transaction not found' }, 404)
            }
        })

        const txReceiptRoute = createRoute({
            method: 'get',
            path: `/tx/{txId}/receipt`,
            request: {
                params: z.object({
                    txId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid transaction hash'),
                })
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: ReceiptSchema,
                        },
                    },
                    description: 'Transaction receipt details',
                },
                404: { description: 'Transaction receipt not found' },
                400: { description: 'Invalid transaction hash' },
            },
            tags: ['Transactions'],
            summary: 'Get transaction receipt by hash',
            description: 'Returns transaction receipt details for the given transaction hash'
        })

        app.openapi(txReceiptRoute, async (c) => {
            const { txId } = c.req.valid('param')

            try {
                const receipt = await getTxReceipt(this.db, this.blockstore, txId)
                return c.json(receipt)
            } catch (error) {
                console.error(error)
                return c.json({ error: 'Transaction receipt not found' }, 404)
            }
        })
    }
}

export async function getTx(db: SQLite3.Database, blockStore: SqliteBlockStore, hash: string): Promise<Transaction> {
    // Find all potential blocks that might contain this transaction (due to hash collision with 5 bytes)
    const stmt = cacheStatement(db, `SELECT blockNumber FROM tx_lookup_table WHERE hash = ?`)
    const results = stmt.all(shortenHash(hash)) as { blockNumber: number }[]
    if (results.length === 0) {
        throw new Error(`Transaction ${hash} not found in tx_lookup_table`)
    }

    console.log(`Found ${results.length} potential blocks for transaction ${hash}:`, results.map(r => r.blockNumber))

    // Search through all potential blocks to find the one with the full matching hash
    for (const result of results) {
        const block = await blockStore.getBlock(result.blockNumber)
        if (!block) {
            continue // Skip if block not found
        }

        const tx = block.block.transactions.find(tx => tx.hash === hash)
        if (tx) {
            return tx
        }
    }

    throw new Error(`Transaction ${hash} not found in any block`)
}

export async function getTxReceipt(db: SQLite3.Database, blockStore: SqliteBlockStore, hash: string): Promise<Receipt> {
    // Find all potential blocks that might contain this transaction (due to hash collision with 5 bytes)
    const stmt = cacheStatement(db, `SELECT blockNumber FROM tx_lookup_table WHERE hash = ?`)
    const results = stmt.all(shortenHash(hash)) as { blockNumber: number }[]
    if (results.length === 0) {
        throw new Error(`Transaction ${hash} not found in tx_lookup_table`)
    }

    console.log(`Found ${results.length} potential blocks for transaction ${hash}:`, results.map(r => r.blockNumber))

    // Search through all potential blocks to find the one with the full matching hash
    for (const result of results) {
        const block = await blockStore.getBlock(result.blockNumber)
        if (!block) {
            continue // Skip if block not found
        }

        const tx = block.receipts[hash]
        if (tx) {
            return tx
        }
    }

    throw new Error(`Transaction ${hash} not found in any block`)
}

export const createTxIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new TxIndexer(context, isWriter)
}




