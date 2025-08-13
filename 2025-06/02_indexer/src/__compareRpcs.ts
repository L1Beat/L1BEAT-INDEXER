import 'dotenv/config';
import { diffString, diff } from 'json-diff';
import { BatchRpc } from './rpc/BatchRpc';

const LOCAL_RPC_URL = 'http://localhost:3000/api/rpc';
const REMOTE_RPC_URL = process.env.RPC_URL;

if (!REMOTE_RPC_URL) {
    console.error('❌ RPC_URL environment variable is not set');
    process.exit(1);
}

console.log('🔍 Comparing RPC endpoints...');
console.log(`   Local:  ${LOCAL_RPC_URL}`);
console.log(`   Remote: ${REMOTE_RPC_URL}\n`);

const localRpc = new BatchRpc({
    rpcUrl: LOCAL_RPC_URL,
    batchSize: 10,
    maxConcurrent: 5,
    rps: 100,
});
const remoteRpc = new BatchRpc({
    rpcUrl: REMOTE_RPC_URL,
    batchSize: 10,
    maxConcurrent: 5,
    rps: 100,
});

// Test 2: eth_chainId / getEvmChainId
console.log('📊 Test 2: Getting chain ID...');
const localChainId = await localRpc.getEvmChainId();
const remoteChainId = await remoteRpc.getEvmChainId();
console.log(`   Local:  ${localChainId} (0x${localChainId.toString(16)})`);
console.log(`   Remote: ${remoteChainId} (0x${remoteChainId.toString(16)})`);
if (localChainId !== remoteChainId) {
    console.error(`   ❌ Chain IDs don't match`);
    console.error(diffString(localChainId, remoteChainId));
    process.exit(1);
} else {
    console.log(`   ✅ Chain IDs match`);
}
console.log();

// Test 3: eth_getBlockByNumber / getBlocksWithReceipts
console.log('📊 Test 3: Getting blocks with transactions...');
const maxBlockNumber = await localRpc.getCurrentBlockNumber();
let randomBlockNumbers = Array.from({ length: 1000 }, () => Math.floor(Math.random() * (maxBlockNumber + 1)));

console.log(`   Testing with 300 random blocks between 0 and ${maxBlockNumber}...`);
const localBlockStartTime = performance.now();
const localBlocks = await localRpc.getBlocksWithReceipts(randomBlockNumbers);
const localBlockTime = performance.now() - localBlockStartTime;
const remoteBlockStartTime = performance.now();
const remoteBlocks = await remoteRpc.getBlocksWithReceipts(randomBlockNumbers);
const remoteBlockTime = performance.now() - remoteBlockStartTime;
console.log(`   Local RPC time: ${localBlockTime.toFixed(2)}ms`);
console.log(`   Remote RPC time: ${remoteBlockTime.toFixed(2)}ms`);
const localBlock = localBlocks[0]?.block;
const remoteBlock = remoteBlocks[0]?.block;
if (!localBlock || !remoteBlock) {
    console.error(`   ❌ One of the blocks is null`);
    console.error(diffString(localBlock, remoteBlock));
    process.exit(1);
}
const differences = diff(localBlock, remoteBlock);
if (differences !== undefined) {
    console.error(`   ❌ Blocks don't match:`);
    console.error(diffString(localBlock, remoteBlock));
    process.exit(1);
} else {
    console.log(`   ✅ Blocks match`);
    console.log(`      - Block hash: ${localBlock.hash}`);
    console.log(`      - Transactions: ${localBlock.transactions?.length || 0}`);
}
console.log();

// Test 5: eth_call (WARP precompile) / fetchBlockchainIDFromPrecompile
console.log('📊 Test 5: Getting blockchain ID from WARP precompile...');
const localResult = await localRpc.fetchBlockchainIDFromPrecompile();
const remoteResult = await remoteRpc.fetchBlockchainIDFromPrecompile();
console.log(`   Local:  ${localResult}`);
console.log(`   Remote: ${remoteResult}`);
if (!localResult || !remoteResult || localResult !== remoteResult) {
    console.error(`   ❌ Blockchain IDs do not match or are invalid`);
    console.error(diffString(localResult, remoteResult));
    process.exit(1);
} else {
    console.log(`   ✅ Blockchain IDs match`);
}
console.log();



// Test 1: eth_blockNumber / getCurrentBlockNumber
console.log('📊 Test 1: Getting current block number...');
const localBlockNumber = await localRpc.getCurrentBlockNumber();
const remoteBlockNumber = await remoteRpc.getCurrentBlockNumber();
console.log(`   Local:  ${localBlockNumber} (0x${localBlockNumber.toString(16)})`);
console.log(`   Remote: ${remoteBlockNumber} (0x${remoteBlockNumber.toString(16)})`);
const blockDiff = Math.abs(localBlockNumber - remoteBlockNumber);
if (blockDiff > 100) {
    console.error(`   ❌ Block numbers differ by ${blockDiff} blocks`);
    process.exit(1);
} else {
    console.log(`   ✅ Block numbers are close (diff: ${blockDiff})`);
}
console.log();


// Summary
console.log('═══════════════════════════════════════');
console.log('✅ All tests passed!');
process.exit(0);
