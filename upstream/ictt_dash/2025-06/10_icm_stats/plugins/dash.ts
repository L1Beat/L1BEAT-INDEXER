import type { ApiPlugin } from "frostbyte-sdk";

const module: ApiPlugin = {
    name: "dash",
    requiredIndexers: [],

    registerRoutes: (app, dbCtx) => {
        //@ts-ignore IDK why ts doesn't like hide
        app.get('/', { schema: { hide: true } }, async (request, reply) => {
            // Get chain data
            const configs = dbCtx.getAllChainConfigs();
            const chains: Array<{
                evmChainId: number;
                chainName: string;
                blockchainId: string;
                hasDebug: boolean;
                lastStoredBlockNumber: number;
                latestRemoteBlockNumber: number;
                txCount: number;
                projectedTxCount: number;
                syncProgress: string;
            }> = [];

            for (const config of configs) {
                const blocksDb = dbCtx.blocksDbFactory(config.evmChainId);

                const lastStoredBlockNumber = blocksDb.getLastStoredBlockNumber();
                const latestRemoteBlockNumber = blocksDb.getBlockchainLatestBlockNum();
                const txCount = blocksDb.getTxCount();

                // Calculate sync progress
                const syncProgress = latestRemoteBlockNumber > 0
                    ? ((lastStoredBlockNumber / latestRemoteBlockNumber) * 100).toFixed(2)
                    : '0.00';

                // Calculate projected transaction count
                let projectedTxCount = txCount;
                if (lastStoredBlockNumber > 0 && latestRemoteBlockNumber > lastStoredBlockNumber) {
                    const blockRatio = latestRemoteBlockNumber / lastStoredBlockNumber;
                    projectedTxCount = Math.round(txCount * blockRatio);
                }

                chains.push({
                    evmChainId: config.evmChainId,
                    chainName: config.chainName,
                    blockchainId: config.blockchainId,
                    hasDebug: blocksDb.getHasDebug() === 1,
                    lastStoredBlockNumber,
                    latestRemoteBlockNumber,
                    txCount,
                    projectedTxCount,
                    syncProgress
                });
            }

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FrostByte Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
    <div class="mx-4">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold text-gray-800">FrostByte Chain Status</h1>
            <a href="/docs" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                API Documentation
            </a>
        </div>
        
        <div class="bg-white shadow-lg rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chain ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chain Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blockchain ID</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Debug</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stored Blocks</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remote Blocks</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sync Progress</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TX Count</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${chains.sort((a, b) => b.projectedTxCount - a.projectedTxCount).map(chain => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${chain.evmChainId}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${chain.chainName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${chain.blockchainId}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${chain.hasDebug
                    ? '<span class="text-green-600">✓</span>'
                    : '<span class="text-gray-400">✗</span>'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${chain.lastStoredBlockNumber.toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${chain.latestRemoteBlockNumber.toLocaleString()}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <div class="flex items-center">
                                <div class="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${chain.syncProgress}%"></div>
                                </div>
                                <span class="text-gray-700">${chain.syncProgress}%</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${chain.txCount.toLocaleString()}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="mt-4 text-sm text-gray-500 text-center">
            Last updated: ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
            `;

            reply.type('text/html').send(html);
        });
    }
};

export default module;
