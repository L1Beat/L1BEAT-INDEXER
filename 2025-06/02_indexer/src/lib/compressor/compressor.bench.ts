import { compress, decompress } from "./compressor";
import { Buffer } from "node:buffer";

// Generate test data of various sizes and characteristics
function generateTestData() {
    const smallObject = {
        id: 12345,
        name: "test user",
        active: true,
        metadata: { created: "2024-01-01", version: "1.0" }
    };

    const mediumObject = {
        users: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            settings: {
                theme: i % 2 === 0 ? "dark" : "light",
                notifications: i % 3 === 0,
                language: ["en", "es", "fr"][i % 3]
            },
            posts: Array.from({ length: 5 }, (_, j) => ({
                id: j,
                title: `Post ${j} by User ${i}`,
                content: "Lorem ipsum ".repeat(20),
                tags: [`tag${j}`, `category${i % 5}`]
            }))
        })),
        metadata: {
            total: 100,
            generated: new Date().toISOString(),
            version: "2.1.0"
        }
    };

    const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({
            timestamp: Date.now() + i,
            value: Math.random() * 1000,
            category: `category_${i % 10}`,
            description: "A ".repeat(50) + `sample description for item ${i}`,
            metrics: {
                cpu: Math.random() * 100,
                memory: Math.random() * 8192,
                disk: Math.random() * 100,
                network: Math.random() * 1000
            },
            tags: Array.from({ length: 5 }, (_, j) => `tag_${i}_${j}`),
            nested: {
                level1: {
                    level2: {
                        level3: `deep_value_${i}`,
                        array: Array.from({ length: 10 }, (_, k) => k * i)
                    }
                }
            }
        }))
    };

    const repetitiveObject = {
        // This should compress very well due to repetition
        repeated: Array.from({ length: 1000 }, () => ({
            same: "this string repeats many times",
            value: 42,
            flag: true,
            list: [1, 2, 3, 4, 5]
        }))
    };

    return { smallObject, mediumObject, largeObject, repetitiveObject };
}

async function benchmark(name: string, data: any) {
    const iterations = 100;

    console.log(`\n🧪 Benchmarking: ${name}`);

    // Measure JSON encoding time
    const jsonStart = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        JSON.stringify(data);
    }
    const jsonTime = Number(process.hrtime.bigint() - jsonStart) / 1_000_000; // ms

    // Measure compression time
    const compressStart = process.hrtime.bigint();
    let compressed: Buffer;
    for (let i = 0; i < iterations; i++) {
        compressed = await compress(data);
    }
    const compressTime = Number(process.hrtime.bigint() - compressStart) / 1_000_000; // ms

    // Measure decompression time
    const decompressStart = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        await decompress(compressed!);
    }
    const decompressTime = Number(process.hrtime.bigint() - decompressStart) / 1_000_000; // ms

    // Calculate sizes
    const originalJsonSize = Buffer.from(JSON.stringify(data), 'utf8').length;
    const compressedSize = compressed!.length;
    const compressionRatio = ((originalJsonSize - compressedSize) / originalJsonSize * 100);

    console.log(`  📊 Original JSON size: ${originalJsonSize.toLocaleString()} bytes`);
    console.log(`  📦 Compressed size: ${compressedSize.toLocaleString()} bytes`);
    console.log(`  📈 Compression ratio: ${compressionRatio.toFixed(1)}%`);
    console.log(`  ⚡ JSON encoding: ${(jsonTime / iterations).toFixed(2)}ms avg`);
    console.log(`  🗜️ Compression: ${(compressTime / iterations).toFixed(2)}ms avg`);
    console.log(`  📤 Decompression: ${(decompressTime / iterations).toFixed(2)}ms avg`);
    console.log(`  🔄 Round-trip: ${((compressTime + decompressTime) / iterations).toFixed(2)}ms avg`);

    return {
        originalSize: originalJsonSize,
        compressedSize,
        compressionRatio,
        jsonTime: jsonTime / iterations,
        compressTime: compressTime / iterations,
        decompressTime: decompressTime / iterations
    };
}

async function runBenchmarks() {
    console.log("🚀 Starting compression benchmarks...\n");

    const testData = generateTestData();

    // Benchmark different data types
    await benchmark("Small Object", testData.smallObject);
    await benchmark("Medium Object", testData.mediumObject);
    await benchmark("Large Object", testData.largeObject);
    await benchmark("Repetitive Object", testData.repetitiveObject);

    console.log("\n✅ Benchmarks completed!");
}

// Run benchmarks if this file is executed directly
if (require.main === module) {
    runBenchmarks().catch(console.error);
}

export { runBenchmarks, generateTestData, benchmark };
