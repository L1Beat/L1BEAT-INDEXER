import { BatchRpc, fetchBlockchainIDFromPrecompile } from "./rpc/rpc.ts"
import type { StoredBlock } from "./rpc/types.ts";
import dotenv from 'dotenv';
import { initializeDatabase, Database } from "./database/db.ts";
import { mkdir } from 'node:fs/promises';
import { SqliteBlockStore } from "./rpc/sqliteCache.ts";
import { startAPI } from "./api.ts";
import { getGlacierRpcUrls } from "./glacier.ts";
import { DATA_FOLDER, INCLUDE_GLACIER, RPC_URLS } from "./config.ts";
import { utils } from "@avalabs/avalanchejs";

dotenv.config();

const interval_seconds = 5; // Default polling interval

//This function is guaranteed to be called in order and inside a transaction
function handleBlock(db: Database, chainId: string, { block, receipts }: StoredBlock) {
    if (Number(block.number) % 100 === 0) {
        console.log(`[${chainId}] handleBlock`, Number(block.number), `with ${Object.keys(receipts).length} receipts`)
    }
    for (const tx of block.transactions) {
        db.insertTxBlockLookup(tx.hash, Number(block.number))
    }
    db.setLastProcessedBlock(Number(block.number))
    db.recordTxCount(Object.keys(receipts).length, Number(block.timestamp))

    //teleporter events

    const TELEPORTER_ADDRESS = "0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf"
    const teleporterTopics = new Map<string, string>([
        ['0x1eac640109dc937d2a9f42735a05f794b39a5e3759d681951d671aabbce4b104', 'BlockchainIDInitialized'],
        ['0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8', 'SendCrossChainMessage'],
        ['0xd13a7935f29af029349bed0a2097455b91fd06190a30478c575db3f31e00bf57', 'ReceiptReceived'],
        ['0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34', 'ReceiveCrossChainMessage'],
        ['0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c', 'MessageExecuted'],
        ['0x4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985', 'MessageExecutionFailed']
    ]);

    //collect icm stats
    const messagesSent: Record<string, number> = {}
    const messagesReceived: Record<string, number> = {}
    for (let receipt of Object.values(receipts)) {
        for (let log of receipt.logs) {
            if (log.address !== TELEPORTER_ADDRESS) continue
            const topic0Name = teleporterTopics.get(log.topics[0]!)
            if (!topic0Name) throw new Error("Unknown teleporter topic, this should not happen")

            if (topic0Name === "SendCrossChainMessage") {
                const receiver = log.topics[2] as string
                if (!receiver) throw new Error("Empty receiver, this should not happen")
                messagesSent[receiver] = (messagesSent[receiver] || 0) + 1
            }
            if (topic0Name === "ReceiveCrossChainMessage") {
                const sender = log.topics[2] as string
                if (!sender) throw new Error("Empty sender, this should not happen")
                messagesReceived[sender] = (messagesReceived[sender] || 0) + 1
            }
        }
    }

    for (let [receiver, count] of Object.entries(messagesSent)) {
        const receiverBase58 = utils.base58check.encode(utils.hexToBuffer(receiver))
        db.recordICMMessagesSent(count, receiverBase58, Number(block.timestamp))
    }

    for (let [sender, count] of Object.entries(messagesReceived)) {
        const senderBase58 = utils.base58check.encode(utils.hexToBuffer(sender))
        db.recordICMMessagesReceived(count, senderBase58, Number(block.timestamp))
    }

}

export class Indexer {
    public rpc: BatchRpc;
    public db: Database;
    private blockchainID: string;
    private isUnlimited: boolean;
    private PROCESSING_BATCH_SIZE: number;

    constructor(rpcUrl: string, blockchainID: string) {
        this.blockchainID = blockchainID;
        this.isUnlimited = rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1') || rpcUrl.includes('65.21.140.118')
        this.PROCESSING_BATCH_SIZE = this.isUnlimited ? 1000 : 100;

        const rawDb = initializeDatabase(blockchainID);
        this.db = new Database(rawDb);

        const cacher = new SqliteBlockStore(`${DATA_FOLDER}/${blockchainID}/blocks.sqlite`);
        const concurrency = this.isUnlimited ? 100 : 10;

        this.rpc = new BatchRpc({
            rpcUrl,
            cache: cacher,
            maxBatchSize: this.isUnlimited ? 100 : 10,
            maxConcurrency: concurrency,
            rps: concurrency * (this.isUnlimited ? 10 : 2)
        });
    }

    async startLoop() {
        console.log(`Starting indexer loop for blockchain ${this.blockchainID}...`);

        let latestBlock: number | null = null;

        while (true) {
            try {
                const start = performance.now();

                let currentBlockToProcess = this.db.getLastProcessedBlock() + 1;

                // Only fetch latest block when:
                // 1. First time (not initialized)
                // 2. When we've caught up to the previously known latest block
                if (latestBlock === null || currentBlockToProcess > latestBlock) {
                    latestBlock = await this.rpc.getCurrentBlockNumber();
                    this.db.setLatestBlockNumber(latestBlock);
                    console.log(`[${this.blockchainID}] Updated latest block from RPC: ${latestBlock}`);
                }

                console.log(`[${this.blockchainID}] Loop iteration. Current block to process: ${currentBlockToProcess}, Latest block: ${latestBlock}`);

                if (currentBlockToProcess > latestBlock) {
                    console.log(`[${this.blockchainID}] Caught up to latest block. Waiting for new blocks...`);
                    await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
                    continue;
                }

                const blockNumbersToFetch: number[] = [];
                const endRange = Math.min(latestBlock, currentBlockToProcess + this.PROCESSING_BATCH_SIZE - 1);

                for (let i = currentBlockToProcess; i <= endRange; i++) {
                    blockNumbersToFetch.push(i);
                }

                if (blockNumbersToFetch.length === 0) {
                    console.log(`[${this.blockchainID}] No new blocks to fetch in this range. Waiting...`);
                    await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
                    continue;
                }

                console.log(`[${this.blockchainID}] Attempting to fetch ${blockNumbersToFetch.length} blocks: from ${blockNumbersToFetch[0]} to ${blockNumbersToFetch[blockNumbersToFetch.length - 1]}`);

                const fetchedBlocks = await this.rpc.getBlocksWithReceipts(blockNumbersToFetch);

                if (fetchedBlocks.length > 0) {
                    console.log(`[${this.blockchainID}] Received ${fetchedBlocks.length} blocks. Processing them in a transaction.`);

                    const txStart = performance.now();
                    this.db.transaction(() => {
                        for (const block of fetchedBlocks) {
                            handleBlock(this.db, this.blockchainID, block);
                        }
                    });
                    console.log(`[${this.blockchainID}] Time taken to process ${fetchedBlocks.length} blocks: ${performance.now() - txStart}ms`);
                    console.log(`[${this.blockchainID}] Successfully processed batch. Last block in DB should now be updated by handleBlock.`);
                } else if (blockNumbersToFetch.length > 0) {
                    console.warn(`[${this.blockchainID}] Requested ${blockNumbersToFetch.length} blocks, but received 0. Possible gap or RPC issue. Waiting before retry.`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                const end = performance.now();
                console.log(`[${this.blockchainID}] Time taken: ${end - start}ms`);

            } catch (error) {
                console.error(`[${this.blockchainID}] Error in indexer loop:`, error);
                console.log(`[${this.blockchainID}] Waiting before retrying...`);
                await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
            }
        }
    }
}

async function main() {
    const envRpcUrls = RPC_URLS
    const glacierRpcUrls = INCLUDE_GLACIER ? (await getGlacierRpcUrls()).map(url => url.rpcUrl) : []

    const indexers = new Map<string, Indexer>();
    const aliases = new Map<string, string>(); // Maps alias -> primary blockchain ID

    console.log({ envRpcUrls, glacierRpcUrls })

    const bannedUrls = ["https://henesys-rpc.msu.io"]

    async function initRpcUrl(rpcUrl: string) {
        if (bannedUrls.includes(rpcUrl)) {
            console.log(`[${rpcUrl}] Skipping banned RPC URL`);
            return;
        }

        let blockchainID = ""

        try {
            blockchainID = await fetchBlockchainIDFromPrecompile(rpcUrl);
        } catch (e) {
            console.log(`[${rpcUrl}] Skipping invalid RPC URL: ${String(e).slice(0, 100)}`);
            return
        }

        // Skip if we already have an indexer for this blockchain ID
        if (indexers.has(blockchainID)) {
            console.log(`[${blockchainID}] Skipping duplicate blockchain ID from RPC URL: ${rpcUrl}`);
            return;
        }

        await mkdir(`${DATA_FOLDER}/${blockchainID}`, { recursive: true });

        const indexer = new Indexer(rpcUrl, blockchainID);

        let evmChainId = 0

        try {
            evmChainId = await indexer.rpc.getEvmChainId()
        } catch (e) {
            console.log(`[${rpcUrl}] Skipping invalid RPC URL: ${String(e).slice(0, 100)}`);
            return;
        }

        console.log(`[${blockchainID}] EVM Chain ID: ${evmChainId}`)

        // Store indexer with primary blockchain ID
        indexers.set(blockchainID, indexer);

        // Add aliases for EVM chain ID
        aliases.set(evmChainId.toString(), blockchainID); // decimal
        aliases.set("0x" + evmChainId.toString(16), blockchainID); // hex
    }

    await Promise.all(envRpcUrls.map(initRpcUrl))
    await Promise.all(glacierRpcUrls.map(initRpcUrl))

    if (indexers.size === 0) {
        console.error("No valid RPC URLs provided");
        process.exit(1);
    }

    startAPI(indexers, aliases).catch(error => {
        console.error("Critical error in startAPI:", error);
        process.exit(1);
    });

    for (const [blockchainID, indexer] of indexers) {
        indexer.startLoop().catch(error => {
            console.error(`[${blockchainID}] Critical error in indexer:`, error);
            process.exit(1);
        });
    }
}

main().catch(error => {
    console.error("Critical error in main:", error);
    process.exit(1);
});
