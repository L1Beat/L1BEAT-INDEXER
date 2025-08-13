import { readFileSync } from 'node:fs';
import { decode } from 'cbor2';
import { encode as cborEncode, decode as cborDecode } from 'cbor2';
import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { Buffer } from 'node:buffer';
import { compressBuffer, decompressBuffer } from './compressor';
const COMPRESSION_LEVEL = 18;
const TEST_FILE = './compression_bench.cbor2';
const ITERATIONS = 100; // Sequential iterations for accurate timing
import { printTable } from 'console-table-printer';


// Helper to convert BigInts to strings in an object for JSON serialization
function replaceBigInts(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'bigint') {
        return obj.toString();
    }

    if (Array.isArray(obj)) {
        return obj.map(replaceBigInts);
    }

    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = replaceBigInts(value);
        }
        return result;
    }

    return obj;
}

async function runBenchmark() {
    console.log('Decoding test data from', TEST_FILE);
    const encodedData = readFileSync(TEST_FILE);
    const originalSize = encodedData.length;
    const testData = decode(encodedData);

    console.log('Test data size (original):', originalSize, 'bytes');

    // Prepare encoders
    const encoders = [
        {
            name: 'CBOR2',
            encode: (data: any) => Buffer.from(cborEncode(data)),
            decode: (data: any) => cborDecode(data)
        },
        {
            name: 'JSON with BigInt->String',
            encode: (data: any) => Buffer.from(JSON.stringify(replaceBigInts(data))),
            decode: (data: any) => JSON.parse(data.toString())
        },
        {
            name: 'MessagePack',
            encode: (data: any) => Buffer.from(msgpackEncode(data)),
            decode: (data: any) => msgpackDecode(data)
        }
    ];

    const results: Record<string, {
        encodeCompressTime: number,
        decodeDecompressTime: number,
        encodedSize: number,
        compressedSize: number,
        ratio: number
    }> = {};

    // Run sequential benchmarks for accurate timing
    for (const encoder of encoders) {
        console.log(`Testing ${encoder.name} with ${ITERATIONS} sequential operations...`);

        let totalEncodeCompressTime = 0;
        let totalDecodeDecompressTime = 0;
        let encodedSize = 0;
        let compressedSize = 0;
        const compressedBuffers: Buffer[] = [];

        // Encode + compress benchmark
        for (let i = 0; i < ITERATIONS; i++) {
            const start = performance.now();
            const encodedBuffer = encoder.encode(testData);
            const compressedBuffer = Buffer.from(await compressBuffer(encodedBuffer, COMPRESSION_LEVEL));
            const end = performance.now();

            totalEncodeCompressTime += (end - start);
            if (i === 0) {
                encodedSize = encodedBuffer.length;
                compressedSize = compressedBuffer.length;
            }
            compressedBuffers.push(compressedBuffer);
        }

        // Decode + decompress benchmark
        for (let i = 0; i < ITERATIONS; i++) {
            const start = performance.now();
            const decompressedBuffer = await decompressBuffer(compressedBuffers[i]!);
            encoder.decode(decompressedBuffer);
            const end = performance.now();

            totalDecodeDecompressTime += (end - start);
        }

        const avgEncodeCompressTime = totalEncodeCompressTime / ITERATIONS;
        const avgDecodeDecompressTime = totalDecodeDecompressTime / ITERATIONS;

        results[encoder.name] = {
            encodeCompressTime: avgEncodeCompressTime,
            decodeDecompressTime: avgDecodeDecompressTime,
            encodedSize,
            compressedSize,
            ratio: originalSize / compressedSize
        };
    }

    // Print results
    console.log(`\nBenchmark Results (${ITERATIONS} iterations, average times):`);

    const tableData = Object.entries(results).map(([name, result]) => ({
        Format: name,
        'Encode+Compress (ms)': result.encodeCompressTime.toFixed(2),
        'Decode+Decompress (ms)': result.decodeDecompressTime.toFixed(2),
        'Ops/sec (E+C)': (1000 / result.encodeCompressTime).toFixed(0),
        'Ops/sec (D+D)': (1000 / result.decodeDecompressTime).toFixed(0),
        'Size Before': result.encodedSize.toLocaleString(),
        'Size After': result.compressedSize.toLocaleString(),
        'Ratio': result.ratio.toFixed(2) + 'x'
    }));

    printTable(tableData);
}

runBenchmark().catch(console.error);
