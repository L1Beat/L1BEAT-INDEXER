import { compress } from "@yu7400ki/zstd-wasm";
import * as fs from "fs";
import * as path from "path";
import { readAllNodeModules } from "./nodem.ts";

const debugData = new TextEncoder().encode(readAllNodeModules('./'));
console.log(debugData.length / 1024 / 1024, 'MB');
for (const concurency of [1, 2, 4, 8, 16]) {
    const startTime = performance.now();
    let promises = [];
    for (let i = 0; i < concurency; i++) {
        promises.push(compress(debugData, 10));
    }
    await Promise.all(promises);
    console.log(`Compressed data size with ${concurency} threads in ${performance.now() - startTime}ms`);
}

