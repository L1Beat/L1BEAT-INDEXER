import { encode, decode } from 'cbor2';
import * as zlib from 'node:zlib';
import { Buffer } from 'node:buffer';

const FLAG_UNCOMPRESSED = 0x00;
const FLAG_ZSTD_CBOR2 = 0x01;
const DEFAULT_COMPRESSION_LEVEL = 6;

/**
 * Compresses a buffer with ZSTD and adds a flag byte
 */
export async function compressBuffer(buffer: Buffer, level: number = DEFAULT_COMPRESSION_LEVEL): Promise<Buffer> {
    // If level 0, skip compression
    if (level === 0) {
        const result = Buffer.alloc(buffer.length + 1);
        result[0] = FLAG_UNCOMPRESSED;
        buffer.copy(result, 1);
        return result;
    }

    // Compress with node:zlib
    const compressedBuffer = await nodeZstdCompress(buffer, level);

    // Prepend flag byte
    const result = Buffer.alloc(compressedBuffer.length + 1);
    result[0] = FLAG_ZSTD_CBOR2;
    compressedBuffer.copy(result, 1);

    return result;
}

/**
 * Decompresses a buffer that was compressed with compressBuffer
 */
export async function decompressBuffer(data: Buffer): Promise<Buffer> {
    const flag = data[0];
    const payload = data.subarray(1);

    if (flag === FLAG_UNCOMPRESSED) {
        return Buffer.from(payload);
    } else if (flag === FLAG_ZSTD_CBOR2) {
        return nodeZstdDecompress(payload);
    } else {
        throw new Error(`Unknown compression flag: ${flag}`);
    }
}

/**
 * Encodes data using CBOR encoding and compresses it with ZSTD (via node:zlib)
 */
export async function compress(data: any, level: number = DEFAULT_COMPRESSION_LEVEL): Promise<Buffer> {
    // First encode the data with CBOR
    const cborEncoded = Buffer.from(encode(data));

    // Compress the encoded buffer
    return compressBuffer(cborEncoded, level);
}

/**
 * Decodes data that was encoded with the compress function
 */
export async function decompress<T>(data: Buffer): Promise<T> {
    // Decompress the buffer
    const decompressedBuf = await decompressBuffer(data);

    // Decode CBOR data
    return decode(decompressedBuf) as T;
}

/**
 * Compresses a Buffer using Node.js ZSTD.
 */
async function nodeZstdCompress(dataBuffer: Buffer, level: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const compressionStream = zlib.createZstdCompress({
            params: {
                [zlib.constants.ZSTD_c_compressionLevel]: level,
                [zlib.constants.ZSTD_c_checksumFlag]: 1,
            },
        });

        compressionStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        compressionStream.on('end', () => resolve(Buffer.concat(chunks)));
        compressionStream.on('error', reject);

        compressionStream.end(dataBuffer);
    });
}

/**
 * Decompresses a Buffer using Node.js ZSTD.
 */
async function nodeZstdDecompress(dataBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const decompressionStream = zlib.createZstdDecompress();

        decompressionStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        decompressionStream.on('end', () => resolve(Buffer.concat(chunks)));
        decompressionStream.on('error', reject);

        decompressionStream.end(dataBuffer);
    });
}
