import { useEffect, useState } from "react"
import { getApiChains } from "./client/sdk.gen"
import { useQuery } from '@tanstack/react-query'
import ErrorComponent from "./components/ErrorComponent"

interface ChainData {
    evmChainId: number;
    chainName: string;
    blockchainId: string;
    hasDebug: boolean;
    lastStoredBlockNumber: number;
    latestRemoteBlockNumber: number;
    txCount: number;
    projectedTxCount: number;
    syncProgress?: string;
}

export default function Sync() {
    const [lastUpdated, setLastUpdated] = useState(new Date())

    const { data: rawChains = [], error, isError } = useQuery<ChainData[]>({
        queryKey: ['chains'],
        queryFn: async () => {
            const res = await getApiChains()
            if (res.data) {
                return res.data.map(chain => ({
                    ...chain,
                    syncProgress: chain.latestRemoteBlockNumber > 0
                        ? ((chain.lastStoredBlockNumber / chain.latestRemoteBlockNumber) * 100).toFixed(2)
                        : '0.00'
                })).sort((a, b) => b.projectedTxCount - a.projectedTxCount)
            }
            throw new Error('Failed to fetch chains')
        }
    })

    useEffect(() => {
        if (rawChains.length > 0) {
            setLastUpdated(new Date())
        }
    }, [rawChains])

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load chain data'} />
    }

    return (
        <div className="py-8 px-0 md:px-8">
            <div className="flex justify-between items-center mb-8 px-4 md:px-0">
                <h1 className="text-3xl font-bold text-gray-800">🔄 Sync Status</h1>
            </div>

            <div className="bg-white shadow-lg md:rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Chain Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Sync Progress</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Chain ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Blockchain ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Debug</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stored Blocks</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Remote Blocks</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">TX Count</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Projected TX</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {rawChains.map(chain => (
                            <tr key={chain.evmChainId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chain.chainName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center">
                                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${chain.syncProgress}%` }}></div>
                                        </div>
                                        <span className="text-gray-700">{chain.syncProgress}%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{chain.evmChainId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{chain.blockchainId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {chain.hasDebug
                                        ? <span className="text-green-600">✓</span>
                                        : <span className="text-gray-400">✗</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chain.lastStoredBlockNumber.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chain.latestRemoteBlockNumber.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chain.txCount.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chain.projectedTxCount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-sm text-gray-500 text-center px-4 md:px-0">
                Last updated: {lastUpdated.toLocaleString()}
            </div>
        </div>
    )
}
