import { decode, encode } from 'cbor2';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';

const FLAG_UNCOMPRESSED = 0x00;
const FLAG_NODE22_ZSTD = 0x01;

/**
 * Encodes data using CBOR encoding and compresses it with ZSTD
 */
export async function compress(data: any): Promise<Buffer> {
    // First encode the data with CBOR
    const cborEncoded = Buffer.from(encode(data));

    // Create ZSTD compression stream with parameters
    const chunks: Buffer[] = [];
    const compressionStream = zlib.createZstdCompress({
        chunkSize: 32 * 1024,
        params: {
            [zlib.constants.ZSTD_c_compressionLevel]: 16,
            [zlib.constants.ZSTD_c_checksumFlag]: 1,
        },
    });

    // Collect compressed chunks
    compressionStream.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Write data to the compression stream
    compressionStream.end(cborEncoded);

    // Wait for the stream to finish
    const compressedData = await new Promise<Buffer>((resolve, reject) => {
        compressionStream.on('end', () => resolve(Buffer.concat(chunks)));
        compressionStream.on('error', reject);
    });

    // Add flag byte at the beginning to indicate compression method
    const result = Buffer.alloc(compressedData.length + 1);
    result[0] = FLAG_NODE22_ZSTD;
    compressedData.copy(result, 1);

    return result;
}

/**
 * Decodes data that was encoded with the compress function
 */
export async function decompress<T>(data: Buffer): Promise<T> {
    // Read the flag byte
    const flag = data[0];
    const compressedData = data.subarray(1);

    let decompressed: Buffer;

    if (flag === FLAG_UNCOMPRESSED) {
        // No compression was used, just decode the CBOR
        decompressed = compressedData;
    } else if (flag === FLAG_NODE22_ZSTD) {
        // ZSTD compression was used
        // Create ZSTD decompression stream
        const chunks: Buffer[] = [];
        const decompressionStream = zlib.createZstdDecompress();

        // Collect decompressed chunks
        decompressionStream.on('data', (chunk: Buffer) => chunks.push(chunk));

        // Write data to the decompression stream
        decompressionStream.end(compressedData);

        // Wait for the stream to finish
        decompressed = await new Promise<Buffer>((resolve, reject) => {
            decompressionStream.on('end', () => resolve(Buffer.concat(chunks)));
            decompressionStream.on('error', reject);
        });
    } else {
        throw new Error(`Unknown compression flag: ${flag}`);
    }

    // Decode CBOR data
    return decode(decompressed) as T;
}
