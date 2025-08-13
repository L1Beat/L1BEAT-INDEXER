import { S3 } from "@aws-sdk/client-s3";
import { MemoryDB } from "./db/memory";
import { Hoarder } from "./hoarder";
import { RPC } from "./hoarder/rpc";
import dotenv from 'dotenv';
import { S3BlockStore } from "./db/s3";
dotenv.config();

const maxBatchSize = 40;
const batchInterval = 200;
const rpc = new RPC(process.env.RPC_URL!, maxBatchSize, batchInterval);


const chainId = await rpc.getBlockchainIDFromPrecompile();

const maxConcurrency = 20;
const hoarder = new Hoarder(new S3BlockStore(chainId), rpc, maxConcurrency);

hoarder.startLoop();
