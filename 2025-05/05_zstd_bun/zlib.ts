import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'node:zlib';
import { Buffer } from "node:buffer";
import { readAllNodeModules } from './nodem';
console.log(">> Start node:zlib compression");

const COMPRESSION_LEVEL = 10;

/**
 * Compresses a Buffer using Node.js ZSTD.
 */
async function nodeZstdCompress(dataBuffer: Buffer, level: number = COMPRESSION_LEVEL): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const compressionStream = zlib.createZstdCompress({
            params: {
                [zlib.constants.ZSTD_c_compressionLevel]: level,
                [zlib.constants.ZSTD_c_checksumFlag]: 1, // Enable checksum, as in the example
            },
        });

        compressionStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        compressionStream.on('end', () => resolve(Buffer.concat(chunks)));
        compressionStream.on('error', reject);

        // Write data to the compression stream and signal that no more data will be written
        compressionStream.end(dataBuffer);
    });
}

const debugData = Buffer.from(new TextEncoder().encode(readAllNodeModules('./')));

for (const concurency of [1, 2, 4, 8, 16]) {
    const startTime = performance.now();
    let promises = [];
    for (let i = 0; i < concurency; i++) {
        promises.push(nodeZstdCompress(debugData));
    }
    await Promise.all(promises);
    console.log(`Compressed data size with ${concurency} threads in ${performance.now() - startTime}ms`);
}

