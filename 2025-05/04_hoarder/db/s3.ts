import type { HoarderDB } from "./types";
import type { StoredBlock } from "./types";
import { compress, decompress } from "./compressor";
import { promises as fs } from 'fs';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export class S3BlockStore implements HoarderDB {
    private bucket: string;
    private s3Client: S3Client;

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
    }

    // Convert block number to storage key using simple padding
    private getKeyFromBlockNumber(blockNumber: number): string {
        return `${this.prefix}/${blockNumber.toString().padStart(12, '0')}.json.zstd`;
    }

    // Convert storage key back to block number
    private getBlockNumberFromKey(key: string): number {
        const filename = key.split('/').pop() || '';
        return parseInt(filename.split('.')[0] || '0', 10);
    }

    async storeBlock(blockNumber: number, block: StoredBlock): Promise<void> {
        const data = await compress(block);
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: this.getKeyFromBlockNumber(blockNumber),
            Body: data
        });
        await this.s3Client.send(command);
    }

    async getBlock(blockNumber: number): Promise<StoredBlock> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: this.getKeyFromBlockNumber(blockNumber)
        });
        const response = await this.s3Client.send(command);
        const data = await response.Body?.transformToByteArray();
        if (!data) {
            throw new Error(`Block ${blockNumber} not found`);
        }
        return decompress(Buffer.from(data)) as Promise<StoredBlock>;
    }

    async getLastStoredBlockNumber(): Promise<number> {
        // List all objects with prefix to find the highest block number
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: this.prefix + '/',
        });

        const response = await this.s3Client.send(command);

        if (!response.Contents || response.Contents.length === 0) {
            throw new Error('No blocks found');
        }

        // Find the highest block number by examining all keys
        let highestBlockNumber = -1;
        for (const item of response.Contents) {
            if (item.Key) {
                const blockNumber = this.getBlockNumberFromKey(item.Key);
                highestBlockNumber = Math.max(highestBlockNumber, blockNumber);
            }
        }

        if (highestBlockNumber === -1) {
            throw new Error('No valid blocks found');
        }

        return highestBlockNumber;
    }
}
