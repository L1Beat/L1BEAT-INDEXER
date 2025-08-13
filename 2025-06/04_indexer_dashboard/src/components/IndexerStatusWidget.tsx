
interface IndexerStatus {
    latestBlockNumber: number
    lastUpdatedTimestamp: number
    healthy: boolean
    lastProcessedBlock: number
    totalTxCount: number
}

interface IndexerStatusWidgetProps {
    chainName: string
    blockchainId: string
    rpcUrl: string
    status?: IndexerStatus
    statusError?: string
}

export default function IndexerStatusWidget({ chainName, blockchainId, rpcUrl, status, statusError }: IndexerStatusWidgetProps) {
    if (statusError) {
        return (
            <div className="bg-white p-4 rounded-lg border shadow-sm border-red-200">
                <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-gray-900 truncate pr-2">{chainName}</div>
                        <div className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Error</div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate" title={blockchainId}>
                        {blockchainId}
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-red-600 font-medium">Failed to fetch</span>
                </div>
                <div className="text-red-500 text-sm mb-2">{statusError}</div>
                <div className="text-xs text-gray-500">
                    <div className="font-medium">RPC URL:</div>
                    <div className="font-mono break-all">{rpcUrl}</div>
                </div>
            </div>
        )
    }

    if (!status) {
        return (
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-gray-900 truncate pr-2">{chainName}</div>
                        <div className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-500">No Data</div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate" title={blockchainId}>
                        {blockchainId}
                    </div>
                </div>
                <div className="text-gray-500 text-sm">No status data available</div>
            </div>
        )
    }

    const indexedPercentage = status.latestBlockNumber === 0 && status.lastProcessedBlock === 0
        ? '100.0'  // Genesis-only chain is fully synced
        : status.latestBlockNumber > 0
            ? (status.lastProcessedBlock / status.latestBlockNumber * 100).toFixed(1)
            : '0'

    const isCaughtUp = status.lastProcessedBlock === status.latestBlockNumber
    const lastUpdated = new Date(status.lastUpdatedTimestamp).toLocaleString()

    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            {/* Header with chain info */}
            <div className="mb-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-gray-900 truncate pr-2">{chainName}</div>
                    <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${isCaughtUp ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {isCaughtUp ? 'Caught Up' : 'Syncing'}
                    </div>
                </div>
                <div className="text-xs text-gray-500 font-mono truncate" title={blockchainId}>
                    {blockchainId}
                </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${status.healthy ? 'text-green-700' : 'text-red-700'}`}>
                    {status.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
                <div className="ml-auto text-sm text-gray-600">
                    {indexedPercentage}% indexed
                </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${indexedPercentage}%` }}
                ></div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                <div>
                    <div className="text-gray-500 text-xs">Latest Block</div>
                    <div className="font-semibold">{status.latestBlockNumber.toLocaleString()}</div>
                </div>
                <div>
                    <div className="text-gray-500 text-xs">Processed</div>
                    <div className="font-semibold">{status.lastProcessedBlock.toLocaleString()}</div>
                </div>
                <div>
                    <div className="text-gray-500 text-xs">Total Txs</div>
                    <div className="font-semibold">{status.totalTxCount.toLocaleString()}</div>
                </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                    Updated: {lastUpdated}
                    <br />{rpcUrl}
                </div>
            </div>
        </div>
    )
} 
