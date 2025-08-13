import type { BlockCache, StoredBlock } from "./types.ts";
import { compress, decompress } from "./compressor.ts";
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import process from "node:process";
import pThrottle from 'p-throttle';
import pLimit from 'p-limit';
import { encode } from "cbor2";
import fs from 'node:fs';


export class S3BlockStore implements BlockCache {
    private bucket: string;
    private s3Client: S3Client;
    private throttledRead: <T>(fn: () => Promise<T>) => Promise<T>;
    private throttledWrite: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private prefix: string) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_BUCKET) {
            throw new Error('AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_BUCKET must be set');
        }
        this.s3Client = new S3Client({
            endpoint: process.env.AWS_ENDPOINT_URL_S3,
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
            }
        });
        this.bucket = process.env.AWS_BUCKET!;

        const readConcurrencyLimit = pLimit(200);
        const writeConcurrencyLimit = pLimit(200);

        const readThrottle = pThrottle({
            limit: 500,
            interval: 1000
        });

        const writeThrottle = pThrottle({
            limit: 500,
            interval: 1000
        });

        this.throttledRead = readThrottle(async (fn) => readConcurrencyLimit(fn));
        this.throttledWrite = writeThrottle(async (fn) => writeConcurrencyLimit(fn));
    }

    // Convert block number to storage key using simple padding
    private getKeyFromBlockNumber(blockNumber: number): string {
        return `${this.prefix}/${blockNumber.toString().padStart(12, '0')}.json.zstd`;
    }

    async saveBlock(blockNumber: number, block: StoredBlock): Promise<void> {
        const originalSize = Buffer.from(encode(block)).length;
        const compressionStarted = performance.now();
        const data = await compress(block);
        const compressedSize = data.length;
        const txCount = block.block.transactions.length;
        const compressionTime = performance.now() - compressionStarted;

        // console.log(`🚃 Block ${blockNumber}: ${txCount} txs, ${(originalSize / 1024).toFixed(2)}KB -> ${(compressedSize / 1024).toFixed(2)}KB (${(originalSize / compressedSize).toFixed(1)}x reduction, ${compressionTime.toFixed(2)}ms compression time)`);

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.getKeyFromBlockNumber(blockNumber),
            Body: data
        });
        await this.throttledWrite(() => this.s3Client.send(command));
    }

    async loadBlock(blockNumber: number): Promise<StoredBlock | null> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: this.getKeyFromBlockNumber(blockNumber)
        });
        try {
            const response = await this.throttledRead(() => this.s3Client.send(command));
            const data = await response.Body?.transformToByteArray();
            if (!data) {
                // This case might be redundant if S3 already threw NoSuchKey for an empty body,
                // but good for robustness if transformToByteArray can return null/undefined for other reasons.
                return null;
            }
            return decompress(Buffer.from(data)) as Promise<StoredBlock>;
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return null;
            }
            throw error; // Re-throw other errors
        }
    }
}
