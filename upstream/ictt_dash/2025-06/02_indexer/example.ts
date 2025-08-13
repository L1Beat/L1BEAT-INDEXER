import * as zstd from 'zstd-napi';
const compressed = zstd.compress(Buffer.from('your data here'));
console.log(compressed);
