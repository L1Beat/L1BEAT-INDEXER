import { ClassicLevel } from "classic-level"

import { decode, encode } from 'cbor2';
import { compress, decompress } from '@mongodb-js/zstd';

// Compression algorithm identifiers
const NO_COMPRESSION = 0;
const ZSTD_COMPRESSION = 1;
const SMALL_VALUE_THRESHOLD = 100;

/**
 * Compresses a value if needed and adds a header byte for compression type
 */
async function compressValue(buffer: Buffer): Promise<Buffer> {
    // If value is small, don't compress
    if (buffer.length < SMALL_VALUE_THRESHOLD) {
        const headerBuffer = Buffer.alloc(1);
        headerBuffer[0] = NO_COMPRESSION;
        return Buffer.concat([headerBuffer, buffer]);
    }

    // Otherwise use zstd compression
    const compressedBuffer = await compress(buffer, 22);
    const headerBuffer = Buffer.alloc(1);
    headerBuffer[0] = ZSTD_COMPRESSION;
    return Buffer.concat([headerBuffer, compressedBuffer]);
}

/**
 * Decompresses a value based on its header byte
 */
async function decompressValue(storedBuffer: Uint8Array): Promise<Buffer> {
    const compressionAlgo = storedBuffer[0];
    const dataBuffer = storedBuffer.subarray(1);

    if (compressionAlgo === NO_COMPRESSION) {
        return Buffer.from(dataBuffer);
    } else if (compressionAlgo === ZSTD_COMPRESSION) {
        return await decompress(Buffer.from(dataBuffer));
    } else {
        throw new Error(`Unknown compression algorithm: ${compressionAlgo}`);
    }
}

export class ArchiverDB {
    private db: ClassicLevel<string, Uint8Array>;

    constructor(folder: string) {
        this.db = new ClassicLevel<string, Uint8Array>(folder, {
            valueEncoding: 'buffer',
            // Optimal block size - 16KB is recommended for general workloads
            // Larger block size (16KB) improves space efficiency and reduces index size
            blockSize: 256 * 1024,
            // Enable compression for better space efficiency
            compression: true,
            // Set maximum open files to -1 to keep all files open and avoid table cache lookups
            maxOpenFiles: -1,
            // Increase write buffer size for better write performance
            writeBufferSize: 64 * 1024 * 1024,  // 64MB
        })
    }

    async save(key: string, value: unknown) {
        const encodedBuffer = Buffer.from(encode(value));
        const compressedBuffer = await compressValue(encodedBuffer);
        // console.log(`Before compression: ${encodedBuffer.length} bytes, After: ${compressedBuffer.length} bytes`);
        await this.db.put(key, compressedBuffer);
    }

    async load<Type = unknown>(key: string): Promise<Type> {
        const storedBuffer = await this.db.get(key);
        if (!storedBuffer) throw new Error(`Key not found: ${key}`);

        const decodedBuffer = await decompressValue(storedBuffer);
        // console.log(`Before decompression: ${storedBuffer.length-1} bytes, After: ${decodedBuffer.length} bytes`);

        return decode(decodedBuffer) as Type;
    }

    async close() {
        await this.db.close();
    }
}
