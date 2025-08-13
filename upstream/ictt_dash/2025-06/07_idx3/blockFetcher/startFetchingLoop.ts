import { BatchRpc } from "./BatchRpc";
import { BlockDB } from "./BlockDB";

const NO_BLOCKS_PAUSE_TIME = 3 * 1000;
const ERROR_PAUSE_TIME = 10 * 1000;

export async function startFetchingLoop(blockDB: BlockDB, batchRpc: BatchRpc, blocksPerBatch: number) {
    let latestRemoteBlock = blockDB.getBlockchainLatestBlockNum()
    //lazy load latest block from the chain
    if (latestRemoteBlock === -1) {
        const newLatestRemoteBlock = await batchRpc.getCurrentBlockNumber();
        blockDB.setBlockchainLatestBlockNum(newLatestRemoteBlock);
        latestRemoteBlock = newLatestRemoteBlock;
    }

    let lastStoredBlock = blockDB.getLastStoredBlockNumber();

    if (blockDB.getEvmChainId() === -1) {
        const newEvmChainId = await batchRpc.getEvmChainId();
        blockDB.setEvmChainId(newEvmChainId);
    }

    while (true) {
        // Check if we've caught up to the latest remote block
        if (lastStoredBlock >= latestRemoteBlock) {
            const newLatestRemoteBlock = await batchRpc.getCurrentBlockNumber();
            if (newLatestRemoteBlock === latestRemoteBlock) {
                console.log(`No new blocks, pause before checking again ${NO_BLOCKS_PAUSE_TIME / 1000}s`);
                await new Promise(resolve => setTimeout(resolve, NO_BLOCKS_PAUSE_TIME));
                continue;
            }
            // Update latest remote block and continue fetching
            latestRemoteBlock = newLatestRemoteBlock;
            console.log(`Updated latest remote block to ${latestRemoteBlock}`);
            blockDB.setBlockchainLatestBlockNum(latestRemoteBlock);
        }

        const startBlock = lastStoredBlock + 1;
        const endBlock = Math.min(startBlock + blocksPerBatch - 1, latestRemoteBlock);
        try {
            const start = performance.now();
            const blockNumbers = Array.from({ length: endBlock - startBlock + 1 }, (_, i) => startBlock + i);
            const blocks = await batchRpc.getBlocksWithReceipts(blockNumbers);
            blockDB.storeBlocks(blocks);
            lastStoredBlock = endBlock;
            const end = performance.now();
            const blocksLeft = latestRemoteBlock - endBlock;
            const blocksPerSecond = blocks.length / (end - start) * 1000;
            const secondsLeft = blocksLeft / blocksPerSecond;
            console.log(`Fetched ${blocks.length} blocks in ${Math.round(end - start)}ms, that's ~${Math.round(blocksPerSecond)} blocks/s, ${blocksLeft.toLocaleString()} blocks left, ~${formatSeconds(secondsLeft)} left`);
        } catch (error) {
            console.error(error);
            await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE_TIME));
        }
    }
}

function formatSeconds(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds) % 60;
    if (days > 0) return `${days}d${hours}h${minutes}m${remainingSeconds}s`;
    if (hours > 0) return `${hours}h${minutes}m${remainingSeconds}s`;
    if (minutes > 0) return `${minutes}m${remainingSeconds}s`;
    return `${hours}h${minutes}m${remainingSeconds}s`;
}
