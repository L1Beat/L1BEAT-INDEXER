import { SqliteBlockStore } from "./system/SqliteBlockStore"
import { Indexer, StoredBlock } from "./types"
import { BatchRpc } from "./rpc/BatchRpc"
import * as config from "./system/config"
import SQLite3 from "better-sqlite3"

async function fetchBlocks(rpc: BatchRpc, blockStore: SqliteBlockStore, blockNumbers: number[]): Promise<StoredBlock[]> {
    const { blocks, missingBlockNumbers } = await blockStore.getBlocks(blockNumbers)
    if (missingBlockNumbers.length === 0) {
        return blocks.filter((block): block is StoredBlock => block !== null)
    }

    const blocksFromRpc = await rpc.getBlocksWithReceipts(missingBlockNumbers)
    await blockStore.storeBlocks(blocksFromRpc)

    // Combine and sort blocks by block number
    const allBlocks = [...blocks.filter((block): block is StoredBlock => block !== null), ...blocksFromRpc]
    return allBlocks.sort((a, b) => parseInt(a.block.number, 16) - parseInt(b.block.number, 16))
}

const SLEEP_TIME_MS = 21 * 1000


export async function startIndexingLoop(db: SQLite3.Database, writers: Indexer[], blockStore: SqliteBlockStore, rpc: BatchRpc, blocksPerBatch: number) {
    for (const writer of writers) {
        writer.initialize()
    }

    let lastProcessedBlockNumber = config.getLastProcessedBlock(db)

    console.log(`Last processed block number: ${lastProcessedBlockNumber}`)

    let latestBlockNumber = await rpc.getCurrentBlockNumber()

    while (true) {
        try {
            latestBlockNumber = await rpc.getCurrentBlockNumber()
            lastProcessedBlockNumber = config.getLastProcessedBlock(db)
            console.log(`Starting indexing loop from block ${lastProcessedBlockNumber.toLocaleString()} to ${latestBlockNumber.toLocaleString()}`)
            break
        } catch (error) {
            console.error('Failed to initialize indexer, retrying in 10 seconds:', error)
            await new Promise(resolve => setTimeout(resolve, SLEEP_TIME_MS))
        }
    }

    let lastStatusUpdateTime = 0

    while (true) {
        try {
            const currentTime = Date.now();
            if (currentTime - lastStatusUpdateTime > 10000) { // 10 seconds
                config.setLastUpdatedTimestamp(db, currentTime);
                lastStatusUpdateTime = currentTime
            }

            // Check if we've reached the end of the chain, update latest block number
            if (lastProcessedBlockNumber >= latestBlockNumber) {
                latestBlockNumber = await rpc.getCurrentBlockNumber()

                console.log(`Latest block number: ${latestBlockNumber}`)

                // If still at the end, sleep and continue
                if (lastProcessedBlockNumber >= latestBlockNumber) {
                    await new Promise(resolve => setTimeout(resolve, SLEEP_TIME_MS))
                    continue
                }
            }

            // Calculate the batch of blocks to process
            const startBlock = lastProcessedBlockNumber + 1
            const endBlock = Math.min(startBlock + blocksPerBatch - 1, latestBlockNumber)
            const blockNumbers = Array.from({ length: endBlock - startBlock + 1 }, (_, i) => startBlock + i)

            // Fetch blocks
            const fetchStart = performance.now()
            const blocks = await fetchBlocks(rpc, blockStore, blockNumbers)
            const fetchEnd = performance.now()

            const processStart = performance.now()
            // Process all blocks with all writers and update config in a single transaction
            db.transaction(() => {
                for (const block of blocks) {
                    for (const writer of writers) {
                        writer.handleBlock(block)
                    }
                }

                // Update progress within the transaction
                config.setLastProcessedBlock(db, endBlock)
                config.setLatestBlockNumber(db, latestBlockNumber)
            })()
            const processEnd = performance.now()

            console.log(`Blocks ${startBlock.toLocaleString()} to ${endBlock.toLocaleString()}: fetched in ${((fetchEnd - fetchStart) / 1000).toFixed(3)}s, processed in ${((processEnd - processStart) / 1000).toFixed(3)}s`)

            // Update our local state after successful transaction
            lastProcessedBlockNumber = endBlock

        } catch (error) {
            console.error('Error in indexing loop:', error)
            // Sleep on error and continue (don't fail silently, but retry)
            await new Promise(resolve => setTimeout(resolve, SLEEP_TIME_MS))
        }
    }
}
