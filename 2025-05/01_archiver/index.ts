import { Archiver } from "./archiver";
import { RPC } from "./archiver/rpc";
import { ArchiverDB } from "./archiver/db";
import dotenv from 'dotenv';

dotenv.config();

const rpc = new RPC(process.env.RPC_URL!);
const chainId = await rpc.getChainId();
const db = new ArchiverDB(`data/archive/${chainId}`);

const archiver = new Archiver(db, rpc);
archiver.startLoop();

archiver.subscribe(async (block) => {
    console.log(block.block.number);
    await new Promise(resolve => setTimeout(resolve, 10));
}, 47000);
