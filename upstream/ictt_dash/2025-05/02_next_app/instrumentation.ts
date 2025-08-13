import { Archiver } from "./lib/archiver/archiver";
import { ArchiverDB } from "./lib/archiver/archiverDB";
import { RPC } from "./lib/archiver/rpc";
import path from 'path';
import fs from 'fs';
import { blocksTable, configTable, StoredBlockData } from "./lib/db/schema";
import { compress } from "./lib/compressor/compress";
import { db } from "./lib/db";
import { eq } from "drizzle-orm";


export async function register() {
    if (!process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME !== 'nodejs') {
        return;
    }

    const rpc = new RPC(process.env.RPC_URL!);
    const chainId = await rpc.getChainId();

    // Create a proper database file path for SQLite
    if (!fs.existsSync(path.resolve(process.cwd(), `./data/`))) {
        fs.mkdirSync(path.resolve(process.cwd(), `./data/`), { recursive: true });
    }
    const dbPath = path.resolve(process.cwd(), `./data/archive_${chainId}.db`);
    const archiver = new Archiver(new ArchiverDB(dbPath), rpc);

    archiver.startLoop();

    let lastIndexedBlockVals = await db.select().from(configTable).where(eq(configTable.key, 'lastIndexedBlock'));
    console.log('lastIndexedBlockVals', lastIndexedBlockVals);

    let lastIndexedBlock = 0;
    if (lastIndexedBlockVals.length === 0) {
        await db.insert(configTable).values({
            key: 'lastIndexedBlock',
            value: "0"
        });
    } else {
        // Value is now text type in schema
        lastIndexedBlock = parseInt(lastIndexedBlockVals[0].value as string);
    }

    console.log(`Last indexed block: ${lastIndexedBlock}`);

    archiver.subscribe(async (block) => {
        //Create  a new block for a block list
        const storedBlockData: StoredBlockData = {
            txNumber: block.block.transactions.length,
            timestamp: Number(block.block.timestamp),
            fee: 0,//TODO: calculate fee later
        };

        const blockNumber = parseInt(block.block.number.toString(), 16);

        const compressedData = await compress(storedBlockData);

        const blockData: typeof blocksTable.$inferInsert = {
            number: blockNumber,
            data: compressedData,
            hash: block.block.hash,
        };

        try {
            await db.transaction(async (tx) => {
                await tx.insert(blocksTable).values(blockData);

                await tx.update(configTable).set({
                    value: blockNumber.toString(),
                }).where(eq(configTable.key, 'lastIndexedBlock'));
            });

            console.log(`Indexed block ${blockNumber}`);
        } catch (error) {
            console.error(`Failed to save block ${blockNumber}:`, error);
        }
    }, lastIndexedBlock);
} 
