import fs from 'node:fs';

const readAllJsFiles = async () => {
    const jsFiles: string[] = [];

    const walkDir = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = `${dir}/${entry.name}`;

            if (entry.isDirectory()) {
                await walkDir(fullPath);
            } else if (entry.name.endsWith('.js')) {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                jsFiles.push(content);
            }
        }
    };

    await walkDir('node_modules');
    return jsFiles.join('\n');
};
console.time('readAllJsFiles');
const nodeModules = await readAllJsFiles();
console.timeEnd('readAllJsFiles');

import { compress, decompress } from './db/compressor';

const original = nodeModules.length;
console.time('compress');
const compressed = await compress(nodeModules, 18);
console.timeEnd('compress');
console.time('decompress');
const decompressed = await decompress<string>(compressed);
console.timeEnd('decompress');

console.log(`Compressed ${compressed.length / 1000} KB, Decompressed ${decompressed.length / 1000} KB, original ${original / 1000} KB, ratio ${original / compressed.length}x`);

