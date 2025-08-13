import dotenv from "dotenv"
dotenv.config()


import { BatchRpc, fetchBlockchainIDFromPrecompile } from "./rpc/rpc.ts"
import { S3BlockStore } from "./rpc/s3cache.ts";
import { rpcSchema, toBytes } from 'viem'
import Database from 'better-sqlite3';
import { BlockCache, StoredBlock } from "./rpc/types.ts";
import { Hex, Transaction, TransactionReceipt, Block as ViemBlock, fromBytes, toBytes as viemToBytes } from 'viem';
const db = new Database('/tmp/foobar2.db');
db.pragma('journal_mode = WAL');

db.exec('CREATE TABLE IF NOT EXISTS tx_block_lookup (hash_to_block BLOB PRIMARY KEY) WITHOUT ROWID;');
db.exec('CREATE TABLE IF NOT EXISTS configs (key TEXT PRIMARY KEY, value TEXT)');
db.prepare('INSERT OR IGNORE INTO configs (key, value) VALUES (?, ?)').run('last_processed_block', '-1');



let indexedRecently = 0
const interval_seconds = 30
setInterval(() => {
    console.log(`🔥 Indexing ${indexedRecently / interval_seconds} tx/s`)
    indexedRecently = 0
}, interval_seconds * 1000)

//This function is guaranteed to be called in order and inside a transaction
function handleBlock({ block, receipts }: StoredBlock) {
    if (Number(block.number) % 100 === 0) {
        console.log('handleBlock', Number(block.number))
    }
    // console.log('handleBlock', Number(block.number))
    for (const tx of block.transactions) {
        const txHashBytes = toBytes(tx.hash)
        // Using block.number which is typically a bigint from viem, ensure it's converted for toBytes if needed, though Number() should suffice for typical range.
        const lookupKey = Buffer.from([...txHashBytes.slice(0, 5), ...toBytes(Number(block.number))])
        db.prepare('INSERT INTO tx_block_lookup (hash_to_block) VALUES (?) ON CONFLICT(hash_to_block) DO NOTHING').run(lookupKey)
    }
    db.prepare('UPDATE configs SET value = ? WHERE key = ?').run(Number(block.number).toString(), 'last_processed_block')
    indexedRecently++
}

export class IndexerAPI {
    private db: Database.Database;
    private rpc: BatchRpc;

    constructor(db: Database.Database, rpc: BatchRpc) {
        this.db = db;
        this.rpc = rpc;
    }

    async getTx(txHash: Hex): Promise<{ transaction: Transaction; receipt: TransactionReceipt; blockNumber: bigint } | null> {
        const fullTxHashBytes = viemToBytes(txHash);
        const prefixBytes = fullTxHashBytes.slice(0, 5);
        const prefixHex = Buffer.from(prefixBytes).toString('hex');

        const lookupKeyRows = this.db.prepare(
            'SELECT hash_to_block FROM tx_block_lookup WHERE hex(hash_to_block) LIKE ?'
        ).all(`${prefixHex}%`) as { hash_to_block: Buffer }[];

        if (lookupKeyRows.length === 0) {
            return null;
        }

        const potentialBlockNumbers = new Set<number>();
        for (const row of lookupKeyRows) {
            const lookupKeyBlob = row.hash_to_block;
            // Ensure lookupKeyBlob is long enough (prefix + at least 1 byte for number)
            if (lookupKeyBlob.length > 5) {
                const blockNumberBytes = lookupKeyBlob.slice(5);
                try {
                    // fromBytes expects Uint8Array. Buffer is a Uint8Array subclass.
                    const blockNumber = fromBytes(blockNumberBytes, 'number');
                    potentialBlockNumbers.add(blockNumber);
                } catch (e) {
                    console.error(`Error parsing block number from lookup key ${lookupKeyBlob.toString('hex')}:`, e);
                }
            }
        }

        if (potentialBlockNumbers.size === 0) {
            return null;
        }

        const blockNumbersToFetch = Array.from(potentialBlockNumbers);
        // Sort to fetch in order, though not strictly necessary for correctness here
        blockNumbersToFetch.sort((a, b) => a - b);

        const fetchedBlocksData = await this.rpc.getBlocksWithReceipts(blockNumbersToFetch);

        for (const storedBlock of fetchedBlocksData) {
            if (storedBlock && storedBlock.block && storedBlock.block.transactions && storedBlock.receipts) {
                for (let i = 0; i < storedBlock.block.transactions.length; i++) {
                    const tx = storedBlock.block.transactions[i];
                    if (tx.hash === txHash) {
                        const receipt = storedBlock.receipts[txHash];
                        if (receipt) {
                            return {
                                transaction: tx,
                                receipt: receipt,
                                blockNumber: storedBlock.block.number
                            };
                        }
                    }
                }
            }
        }
        return null;
    }
}

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) {
    console.error("RPC_URL environment variable is not set.");
    process.exit(1);
}

const PROCESSING_BATCH_SIZE = 10; // Number of blocks to fetch and process per cycle
const blockchainID = await fetchBlockchainIDFromPrecompile(rpcUrl);
const cacher = new S3BlockStore(blockchainID); // This is the BlockCache instance
const concurrency = 20
const rpc = new BatchRpc({
    rpcUrl,
    cache: cacher,
    maxBatchSize: 10,
    maxConcurrency: concurrency,
    rps: concurrency * 2
});

const indexer = new IndexerAPI(db, rpc);

async function startLoop() {



    console.log('Starting indexer loop...');

    while (true) {
        const latestBlock = await rpc.getCurrentBlockNumber();

        const lastProcessedBlockResp = db.prepare('SELECT value FROM configs WHERE key = ?').get('last_processed_block') as { value: string };
        let currentBlockToProcess = parseInt(lastProcessedBlockResp.value) + 1;

        console.log(`Loop iteration. Current block to process: ${currentBlockToProcess}, Latest block from RPC: ${latestBlock}`);

        if (currentBlockToProcess > latestBlock) {
            console.log(`Caught up to the latest block (${latestBlock}). Waiting for new blocks...`);
            await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
            continue;
        }

        const blockNumbersToFetch: number[] = [];
        const endRange = Math.min(latestBlock, currentBlockToProcess + PROCESSING_BATCH_SIZE - 1);

        for (let i = currentBlockToProcess; i <= endRange; i++) {
            blockNumbersToFetch.push(i);
        }

        if (blockNumbersToFetch.length === 0) {
            // This might happen if latestBlock was equal to currentBlockToProcess - 1, covered by the previous check.
            console.log('No new blocks to fetch in this range. Waiting...');
            await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
            continue;
        }

        console.log(`Attempting to fetch ${blockNumbersToFetch.length} blocks: from ${blockNumbersToFetch[0]} to ${blockNumbersToFetch[blockNumbersToFetch.length - 1]}`);

        try {
            const fetchedBlocks = await rpc.getBlocksWithReceipts(blockNumbersToFetch);

            if (fetchedBlocks.length > 0) {
                console.log(`Received ${fetchedBlocks.length} blocks. Processing them in a transaction.`);
                db.transaction(() => {
                    for (const block of fetchedBlocks) {
                        // handleBlock updates 'last_processed_block' in the DB for each block
                        handleBlock(block);
                    }
                })();
                console.log(`Successfully processed batch. Last block in DB should now be updated by handleBlock.`);
            } else if (blockNumbersToFetch.length > 0) {
                console.warn(`Requested ${blockNumbersToFetch.length} blocks, but received 0. Possible gap or RPC issue. Waiting before retry.`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Short delay before retrying loop
            }
            // If fetchedBlocks.length is 0 and blockNumbersToFetch.length was also 0, earlier continue handles it.

        } catch (error) {
            console.error(`Error during block fetching or processing batch starting from ${blockNumbersToFetch[0]}:`, error);
            console.log('Waiting before retrying...');
            await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
        }
    }
}

startLoop().catch(error => {
    console.error("Critical error in startLoop:", error);
    process.exit(1);
});
