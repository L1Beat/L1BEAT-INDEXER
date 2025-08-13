import cluster from 'node:cluster';
import fs from 'node:fs';
import path from 'node:path';
import { BlockDB } from './blockFetcher/BlockDB';
import { startFetchingLoop } from './blockFetcher/startFetchingLoop';
import { BatchRpc } from './blockFetcher/BatchRpc';
import { createRPCIndexer } from './indexers/rpc';
import { OpenAPIHono } from '@hono/zod-openapi';
import Database from 'better-sqlite3';
import { executePragmas, IndexingDbHelper } from './indexers/dbHelper';

import { IS_DEVELOPMENT, RPC_URL, CHAIN_ID, DATA_DIR, RPS, REQUEST_BATCH_SIZE, MAX_CONCURRENT, BLOCKS_PER_BATCH, DEBUG_RPC_AVAILABLE } from './config';
import { createSanityChecker } from './indexers/sanityChecker';
import { createMetricsIndexer } from './indexers/metrics';
import { Indexer } from './indexers/types';
import { serve } from '@hono/node-server';
import { createTeleporterMetricsIndexer } from './indexers/teleporterMetrics';
import { createInfoIndexer } from './indexers/info';

const blocksDbPath = path.join(DATA_DIR, CHAIN_ID, DEBUG_RPC_AVAILABLE ? 'blocks.db' : 'blocks_no_dbg.db');
const indexingDbPath = path.join(path.dirname(blocksDbPath), DEBUG_RPC_AVAILABLE ? 'indexing.db' : 'indexing_no_dbg.db');
if (!fs.existsSync(blocksDbPath)) {
    fs.mkdirSync(path.dirname(blocksDbPath), { recursive: true });
}

const indexerFactories = [
    createRPCIndexer,
    createMetricsIndexer,
    createTeleporterMetricsIndexer,
    createInfoIndexer,
];
if (IS_DEVELOPMENT) {
    indexerFactories.push(createSanityChecker);
}

const docsPage = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Elements in HTML</title>
  
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  </head>
  <body>

    <elements-api
      apiDescriptionUrl="/api/openapi.json"
      router="hash"
    />

  </body>
</html>
`

if (cluster.isPrimary) {
    // spawn one writer, one reader, one misc-job worker
    cluster.fork({ ROLE: 'fetcher' });
    cluster.fork({ ROLE: 'api' });
    cluster.fork({ ROLE: 'indexer' });
} else {
    if (process.env['ROLE'] === 'fetcher') {
        const blocksDb = new BlockDB({ path: blocksDbPath, isReadonly: false, hasDebug: DEBUG_RPC_AVAILABLE });
        const batchRpc = new BatchRpc({
            rpcUrl: RPC_URL,
            batchSize: REQUEST_BATCH_SIZE,
            maxConcurrent: MAX_CONCURRENT,
            rps: RPS,
            enableBatchSizeGrowth: false,
            rpcSupportsDebug: DEBUG_RPC_AVAILABLE,
        });
        startFetchingLoop(blocksDb, batchRpc, BLOCKS_PER_BATCH);
    } else if (process.env['ROLE'] === 'api') {
        //awaits both files as it is read only for both
        await awaitFileExists(indexingDbPath);
        await awaitFileExists(blocksDbPath);

        const blocksDb = new BlockDB({ path: blocksDbPath, isReadonly: true, hasDebug: DEBUG_RPC_AVAILABLE });
        const indexingDb = new Database(indexingDbPath, { readonly: true });

        await executePragmas({ db: indexingDb, isReadonly: true });

        const app = new OpenAPIHono();

        for (const indexerFactory of indexerFactories) {
            const indexer = indexerFactory(blocksDb, indexingDb);
            indexer.registerRoutes(app);
        }

        // Add OpenAPI documentation endpoint
        app.doc('/api/openapi.json', {
            openapi: '3.0.0',
            info: {
                version: '1.0.0',
                title: 'Blockchain Indexer API',
                description: 'API for querying blockchain data and metrics'
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Local development server'
                }
            ]
        });

        console.log('Starting server on http://localhost:3000/');
        app.get('/', (c) => c.html(`<a href="/docs">OpenAPI documentation</a>`))
        app.get('/docs', (c) => c.html(docsPage))

        serve({
            fetch: app.fetch,
            port: 3000
        });
    } else if (process.env['ROLE'] === 'indexer') {
        await awaitFileExists(blocksDbPath);

        const blocksDb = new BlockDB({ path: blocksDbPath, isReadonly: true, hasDebug: DEBUG_RPC_AVAILABLE });
        const indexingDb = new Database(indexingDbPath, { readonly: false });
        const indexingDbHelper = new IndexingDbHelper(indexingDb);
        const indexers: Indexer[] = indexerFactories.map(factory => {
            const indexer = factory(blocksDb, indexingDb);
            indexer.initialize();
            return indexer;
        });

        await executePragmas({ db: indexingDb, isReadonly: false });

        let hadSomethingToIndex = false;

        const runIndexing = indexingDb.transaction((lastIndexedBlock) => {
            const getStart = performance.now();
            const blocks = blocksDb.getBlocks(lastIndexedBlock + 1, 10 * 1000);//batches of 10k txs
            const indexingStart = performance.now();
            hadSomethingToIndex = blocks.length > 0;
            let debugTxCount = 0
            if (hadSomethingToIndex) {
                for (const { block, txs, traces } of blocks) {
                    debugTxCount += txs.length;
                    for (const indexer of indexers) {
                        indexer.indexBlock(block, txs, traces);
                    }
                }
                const indexingFinish = performance.now();
                indexingDbHelper.setInteger('lastIndexedBlock', blocks[blocks.length - 1]!.block.number);
                console.log('Got', debugTxCount, 'txs in', Math.round(indexingStart - getStart), 'ms', 'indexing', Math.round(indexingFinish - indexingStart), 'ms');
            }
        });

        while (true) {
            runIndexing(indexingDbHelper.getInteger('lastIndexedBlock', -1));
            if (!hadSomethingToIndex) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        process.exit(1);
    } else {
        throw new Error('unknown role');
    }
}


async function awaitFileExists(path: string, maxMs: number = 3 * 1000, intervalMs: number = 100) {
    const startTime = Date.now();
    while (true) {
        if (fs.existsSync(path)) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        if (Date.now() - startTime > maxMs) {
            throw new Error(`File ${path} did not exist after ${maxMs} ms`);
        }
    }
}
