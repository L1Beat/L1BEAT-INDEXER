import { compress, decompress } from "./compressor";
import { Buffer } from "node:buffer";
import assert from "node:assert";
import test from "node:test";

test("should compress and decompress a simple object", async () => {
    const originalData = { message: "hello world", count: 42 };
    const compressed = await compress(originalData);
    const decompressed = await decompress<typeof originalData>(compressed);
    assert.deepEqual(decompressed, originalData);
});

test("should compress and decompress with different compression levels", async () => {
    const originalData = {
        a: "a".repeat(1000),
        b: "b".repeat(1000)
    };

    // Use level 0 (uncompressed) vs default level
    const compressedWithLevel0 = await compress(originalData, 0);
    const compressedDefault = await compress(originalData);

    // Level 0 should definitely be different from default compression
    assert.notEqual(compressedWithLevel0.length, compressedDefault.length);

    // Both should correctly decompress
    const decompressedLevel0 = await decompress<typeof originalData>(compressedWithLevel0);
    const decompressedDefault = await decompress<typeof originalData>(compressedDefault);

    assert.deepEqual(decompressedLevel0, originalData);
    assert.deepEqual(decompressedDefault, originalData);
});

test("should decompress uncompressed data", async () => {
    const originalData = "hello";
    // Manually create "compressed" data with FLAG_UNCOMPRESSED
    const jsonEncoded = Buffer.from(JSON.stringify(originalData), 'utf8');

    const uncompressedFlag = 0x00;
    const dataWithUncompressedFlag = Buffer.concat([Buffer.from([uncompressedFlag]), jsonEncoded]);

    const decompressed = await decompress<string>(dataWithUncompressedFlag);
    assert.deepEqual(decompressed, originalData);
});

test("should throw an error for an unknown compression flag", async () => {
    const fakeData = Buffer.from([0x99, 0x01, 0x02, 0x03]); // Unknown flag 0x99
    await assert.rejects(() => decompress(fakeData), {
        name: 'Error',
        message: /Unknown compression flag/
    });
});

test("compress should produce a buffer starting with the ZSTD flag", async () => {
    const originalData = { test: "flag check" };
    const compressed = await compress(originalData);
    const FLAG_ZSTD_JSON = 0x01;
    assert.equal(compressed[0], FLAG_ZSTD_JSON);
});

test("decompression of empty or minimal data", async () => {
    // Test with an empty object
    const emptyObj = {};
    const compressedEmptyObj = await compress(emptyObj);
    const decompressedEmptyObj = await decompress<typeof emptyObj>(compressedEmptyObj);
    assert.deepEqual(decompressedEmptyObj, emptyObj);

    // Test with null
    const nullData = null;
    const compressedNull = await compress(nullData);
    const decompressedNull = await decompress<typeof nullData>(compressedNull);
    assert.deepEqual(decompressedNull, nullData);
});

test("should correctly decompress data marked as uncompressed", async () => {
    const originalData = { type: "uncompressed_test", value: 12345 };
    const jsonEncoded = Buffer.from(JSON.stringify(originalData), 'utf8');
    const FLAG_UNCOMPRESSED = 0x00;

    const dataWithUncompressedFlag = Buffer.alloc(jsonEncoded.length + 1);
    dataWithUncompressedFlag[0] = FLAG_UNCOMPRESSED;
    jsonEncoded.copy(dataWithUncompressedFlag, 1);

    const decompressed = await decompress<typeof originalData>(dataWithUncompressedFlag);
    assert.deepEqual(decompressed, originalData);
});

test("should handle complex nested objects", async () => {
    const complexData = {
        users: [
            { id: 1, name: "Alice", settings: { theme: "dark", notifications: true } },
            { id: 2, name: "Bob", settings: { theme: "light", notifications: false } }
        ],
        metadata: {
            version: "1.0.0",
            created: "2024-01-01T00:00:00Z",
            features: ["compression", "json", "zstd"]
        }
    };

    const compressed = await compress(complexData);
    const decompressed = await decompress<typeof complexData>(compressed);
    assert.deepEqual(decompressed, complexData);
});

test("should handle arrays and primitives", async () => {
    const arrayData = [1, 2, 3, "hello", true, null, { nested: "object" }];
    const compressed = await compress(arrayData);
    const decompressed = await decompress<typeof arrayData>(compressed);
    assert.deepEqual(decompressed, arrayData);
});

