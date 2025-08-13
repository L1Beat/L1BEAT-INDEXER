import Database from 'better-sqlite3';
import { StoredBlock } from './BatchRpc';
import { encodeLazyBlock, LazyBlock } from './lazy/LazyBlock';
import { encodeLazyTx, LazyTx } from './lazy/LazyTx';
import { compressSync as lz4CompressSync, uncompressSync as lz4UncompressSync } from 'lz4-napi';
import { LazyTraces, encodeLazyTraces } from './lazy/LazyTrace';

export class BlockDB {
    private db: InstanceType<typeof Database>;

    private prepped: Map<string, any>;
    private isReadonly: boolean;
    private hasDebug: boolean;

    constructor({ path, isReadonly, hasDebug }: { path: string, isReadonly: boolean, hasDebug: boolean }) {
        this.db = new Database(path, {
            readonly: isReadonly,
        });
        this.isReadonly = isReadonly;
        this.initPragmas(isReadonly);
        if (!isReadonly) {
            this.initSchema();
        }
        this.prepped = new Map();

        // Check and validate hasDebug setting
        const storedHasDebug = this.getHasDebug();
        console.log('storedHasDebug', storedHasDebug, 'hasDebug', hasDebug);
        if (storedHasDebug === -1) {
            // Never set before, set it now
            if (!isReadonly) {
                this.setHasDebug(hasDebug);
            }
        } else {
            // Already set, must match
            const storedBool = storedHasDebug === 1;
            if (storedBool !== hasDebug) {
                throw new Error(`Database hasDebug mismatch: stored=${storedBool}, provided=${hasDebug}`);
            }
        }

        this.hasDebug = hasDebug;
    }


    //TODO: could be more efficient, but decoding is 60% of the time now. So 2x faster queries would improve the overall performance only by 20%.
    getBlocks(start: number, maxTransactions: number): { block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined }[] {
        const totalStart = performance.now();
        let queryTime = 0;
        let decodingTime = 0;

        // First, efficiently find which blocks to fetch based on transaction count
        const planStart = performance.now();
        const selectTxCounts = this.prepQuery(`
            SELECT block_id, COUNT(*) as tx_count 
            FROM txs 
            WHERE block_id >= ? 
            GROUP BY block_id 
            ORDER BY block_id 
            LIMIT ${Number(maxTransactions)}
        `);
        const txCounts = selectTxCounts.all(start) as { block_id: number, tx_count: number }[];

        let totalTxs = 0;
        let blocksToFetch: number[] = [];
        for (const { block_id, tx_count } of txCounts) {
            if (totalTxs + tx_count > maxTransactions && blocksToFetch.length > 0) {
                break;
            }
            blocksToFetch.push(block_id);
            totalTxs += tx_count;
            if (totalTxs >= maxTransactions) {
                break;
            }
        }

        const planTime = performance.now() - planStart;
        queryTime += planTime;

        if (blocksToFetch.length === 0) {
            return [];
        }

        let result: { block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined }[] = [];

        for (const blockNumber of blocksToFetch) {
            // Time block query
            const blockQueryStart = performance.now();
            const selectBlock = this.prepQuery('SELECT data, traces FROM blocks WHERE id = ?');
            const blockResult = selectBlock.get(blockNumber) as { data: Buffer, traces: Buffer | null } | undefined;
            queryTime += performance.now() - blockQueryStart;

            if (!blockResult) throw new Error(`Block ${blockNumber} not found`);

            // Time block decoding
            const blockDecodeStart = performance.now();
            const decompressedBlockData = lz4UncompressSync(blockResult.data);
            const block = new LazyBlock(decompressedBlockData);

            // Decode traces based on hasDebug flag
            let traces: LazyTraces | undefined = undefined;
            if (this.hasDebug) {
                if (!blockResult.traces) {
                    throw new Error(`hasDebug is true but no traces found for block ${blockNumber} - data corruption`);
                }
                const decompressedTracesData = lz4UncompressSync(blockResult.traces);
                traces = new LazyTraces(decompressedTracesData);
            }
            decodingTime += performance.now() - blockDecodeStart;

            const txs: LazyTx[] = [];
            for (let txIndex = 0; txIndex < block.transactionCount; txIndex++) {
                // Time tx query
                const txQueryStart = performance.now();
                const selectTx = this.prepQuery('SELECT data FROM txs WHERE block_id = ? AND tx_ix = ?');
                const txResult = selectTx.get(blockNumber, txIndex) as { data: Buffer } | undefined;
                queryTime += performance.now() - txQueryStart;

                if (!txResult) throw new Error(`Tx ${blockNumber}:${txIndex} not found`);

                // Time tx decoding
                const txDecodeStart = performance.now();
                const decompressedTxData = lz4UncompressSync(txResult.data);
                const tx = new LazyTx(decompressedTxData);
                decodingTime += performance.now() - txDecodeStart;

                txs.push(tx);
            }
            result.push({ block, txs, traces });
        }

        const totalTime = performance.now() - totalStart;
        console.log(`getBlocks(${start}, max ${maxTransactions} txs): got ${totalTxs} txs in ${blocksToFetch.length} blocks, total=${Math.round(totalTime)}ms, query=${Math.round(queryTime)}ms, decode=${Math.round(decodingTime)}ms`);

        return result;
    }

    getEvmChainId(): number {
        const select = this.prepQuery('SELECT value FROM kv_int WHERE key = ?');
        const result = select.get('evm_chain_id') as { value: number } | undefined;
        return result?.value ?? -1;
    }

    setEvmChainId(chainId: number) {
        const upsert = this.prepQuery('INSERT OR REPLACE INTO kv_int (key, value) VALUES (?, ?)');
        upsert.run('evm_chain_id', chainId);
    }

    getLastStoredBlockNumber(): number {
        const selectMax = this.prepQuery('SELECT MAX(id) as max_id FROM blocks');
        const result = selectMax.get() as { max_id: number | null } | undefined;
        const result2 = result?.max_id ?? -1;
        return result2;
    }

    storeBlocks(batch: StoredBlock[]) {
        if (this.isReadonly) throw new Error('BlockDB is readonly');
        if (batch.length === 0) return;

        let lastStoredBlockNum = this.getLastStoredBlockNumber();

        const insertMany = this.db.transaction((batch: StoredBlock[]) => {
            for (let i = 0; i < batch.length; i++) {
                const block = batch[i]!;
                if (Number(block.block.number) !== lastStoredBlockNum + 1) {
                    throw new Error(`Batch not sorted or has gaps: expected ${lastStoredBlockNum + 1}, got ${Number(block.block.number)}`);
                }
                this.storeBlock(block);
                lastStoredBlockNum++;
            }
        });
        insertMany(batch);
    }

    getBlock(n: number): LazyBlock {
        const selectBlock = this.prepQuery('SELECT data FROM blocks WHERE id = ?');
        const result = selectBlock.get(n) as { data: Buffer } | undefined;
        if (!result) throw new Error(`Block ${n} not found`);

        // Decompress the data
        const decompressedData = lz4UncompressSync(result.data);
        return new LazyBlock(decompressedData);
    }

    getTx(n: number, ix: number): LazyTx {
        const selectTx = this.prepQuery('SELECT data FROM txs WHERE block_id = ? AND tx_ix = ?');
        const result = selectTx.get(n, ix) as { data: Buffer } | undefined;
        if (!result) throw new Error(`Tx ${n}:${ix} not found`);

        // Decompress the data
        const decompressedData = lz4UncompressSync(result.data);
        return new LazyTx(decompressedData);
    }

    getBlockWithTransactions(blockNumber: number): { block: LazyBlock, txs: LazyTx[] } {
        // Get the block first
        const block = this.getBlock(blockNumber);

        // Query all transactions for this block at once, ordered by tx_ix
        const selectTxs = this.prepQuery('SELECT data FROM txs WHERE block_id = ? ORDER BY tx_ix');
        const results = selectTxs.all(blockNumber) as { data: Buffer }[];

        if (results.length !== block.transactionCount) {
            throw new Error(`Expected ${block.transactionCount} transactions for block ${blockNumber}, but found ${results.length}`);
        }

        // Decompress and create LazyTx objects
        const txs: LazyTx[] = [];
        for (const result of results) {
            const decompressedData = lz4UncompressSync(result.data);
            txs.push(new LazyTx(decompressedData));
        }

        return { block, txs };
    }

    getBlockTransactions(blockNumber: number): LazyTx[] {
        return this.getBlockWithTransactions(blockNumber).txs;
    }

    setBlockchainLatestBlockNum(blockNumber: number) {
        if (this.isReadonly) throw new Error('BlockDB is readonly');
        const upsert = this.prepQuery('INSERT OR REPLACE INTO kv_int (key, value) VALUES (?, ?)');
        upsert.run('blockchain_latest_block', blockNumber);
    }

    getBlockchainLatestBlockNum(): number {
        const select = this.prepQuery('SELECT value FROM kv_int WHERE key = ?');
        const result = select.get('blockchain_latest_block') as { value: number } | undefined;
        return result?.value ?? -1;
    }

    close() {
        this.db.close();
    }

    private prepQuery(query: string) {
        if (this.prepped.has(query)) return this.prepped.get(query)!;
        const prepped = this.db.prepare(query);
        this.prepped.set(query, prepped);
        return prepped;
    }

    private storeBlock(b: StoredBlock) {
        // Validate hasDebug flag vs traces presence
        if (this.hasDebug && b.traces === undefined) {
            throw new Error('hasDebug is true but StoredBlock.traces is undefined');
        }
        if (!this.hasDebug && b.traces !== undefined) {
            throw new Error('hasDebug is false but StoredBlock.traces is defined');
        }

        const insertBlock = this.prepQuery('INSERT INTO blocks(id, data, traces) VALUES (?, ?, ?)');
        const insertTx = this.prepQuery('INSERT INTO txs(block_id, tx_ix, data) VALUES (?, ?, ?)');

        const blockNumber = Number(b.block.number);

        // Compress block data before storing
        const blockData = encodeLazyBlock(b.block);
        const compressedBlockData = lz4CompressSync(Buffer.from(blockData));

        // Handle traces if hasDebug is true
        let compressedTracesData: Buffer | null = null;
        if (this.hasDebug && b.traces) {
            // Encode all traces into a single buffer with one RLP call
            const tracesData = encodeLazyTraces(b.traces);
            compressedTracesData = lz4CompressSync(Buffer.from(tracesData));
        }

        insertBlock.run(blockNumber, compressedBlockData, compressedTracesData);

        for (let i = 0; i < b.block.transactions.length; ++i) {
            const tx = b.block.transactions[i]!;
            const receipt = b.receipts[tx.hash];
            if (!receipt) throw new Error(`Receipt not found for tx ${tx.hash}`);

            // Compress transaction data before storing
            const txData = encodeLazyTx(tx, receipt);
            const compressedTxData = lz4CompressSync(Buffer.from(txData));
            insertTx.run(blockNumber, i, compressedTxData);
        }
    }

    private initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocks (
        id     INTEGER PRIMARY KEY,
        data   BLOB NOT NULL,
        traces BLOB
      ) WITHOUT ROWID;

      CREATE TABLE IF NOT EXISTS txs (
        block_id INTEGER NOT NULL,
        tx_ix    INTEGER NOT NULL,
        data     BLOB NOT NULL,
        PRIMARY KEY (block_id, tx_ix)
      ) WITHOUT ROWID;

      CREATE TABLE IF NOT EXISTS kv_int (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) WITHOUT ROWID;
    `);
    }

    private initPragmas(isReadonly: boolean) {
        // 8 KiB pages = good balance for sequential writes & mmap reads
        this.db.pragma('page_size = 8192');

        if (!isReadonly) {
            // *** WRITER: fire-and-forget speed ***
            this.db.pragma('journal_mode      = WAL');         // enables concurrent readers
            this.db.pragma('synchronous       = OFF');         // lose at most one commit on crash
            this.db.pragma('wal_autocheckpoint = 20000');      // ~80 MB before checkpoint pause
            this.db.pragma('mmap_size         = 0');           // writer gains nothing from mmap
            this.db.pragma('cache_size        = -262144');     // 256 MiB page cache
            this.db.pragma('temp_store        = MEMORY');      // keep temp B-trees off disk
        } else {
            // *** READER: turbo random look-ups ***
            this.db.pragma('query_only         = TRUE');       // hard-lock to read-only
            this.db.pragma('read_uncommitted   = TRUE');       // skip commit window wait
            this.db.pragma('mmap_size          = 1099511627776'); // 1 TB
            this.db.pragma('cache_size         = -1048576');   // 1 GiB page cache
            this.db.pragma('busy_timeout       = 0');          // fail fast if writer stalls
        }
    }

    getHasDebug(): number {
        const select = this.prepQuery('SELECT value FROM kv_int WHERE key = ?');
        const result = select.get('hasDebug') as { value: number } | undefined;
        return result?.value ?? -1;
    }

    setHasDebug(hasDebug: boolean) {
        const upsert = this.prepQuery('INSERT OR REPLACE INTO kv_int (key, value) VALUES (?, ?)');
        upsert.run('hasDebug', hasDebug ? 1 : 0);
    }
}
