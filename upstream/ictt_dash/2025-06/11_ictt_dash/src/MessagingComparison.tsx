import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"
import TimeRangeSelector from "./components/TimeRangeSelector"
import layerZeroIds from "./components/lz_data/layerZeroIds.json"
import { WELL_KNOWN_CHAINS } from "../plugins/lib/WellKnownChains"

const layerZeroIdsMap: Map<string, {
    name: string,
    isAvalanche: boolean,
}> = new Map(Object.entries(layerZeroIds) as [string, {
    name: string,
    isAvalanche: boolean,
}][])

interface ChainPair {
    otherChainId: string
    protocol: 'icm' | 'layerzero'
    inbound: number
    outbound: number
    total: number
}

interface DetailedChainComparison {
    chainId: number
    chainName: string
    blockchainId: string
    layerzeroTotal: number
    icmTotal: number
    chainPairs: ChainPair[]
}

interface TableRow {
    chains: string
    protocol: 'icm' | 'layerzero'
    count: number
}

// Color schemes
const PROTOCOL_COLORS = {
    icm: '#3b82f6',       // Blue
    layerzero: '#8b5cf6'  // Purple
}

// Common LayerZero endpoint IDs to chain names (fallback)
const LAYERZERO_CHAINS: Record<string, string> = {
    '101': 'External - Ethereum',
    '30168': 'External - Solana',
    // Add more as needed
}

// Helper to format chain ID
function formatChainId(chainId: string, protocol: 'icm' | 'layerzero', chainLookup?: Map<string, string>): string {
    if (protocol === 'layerzero') {
        // Prefer dynamic lookup from the imported LayerZero IDs map
        const direct = layerZeroIdsMap.get(chainId)
        if (direct) {
            const baseName = direct.name ?? `LZ ${chainId}`
            if (direct.isAvalanche) {
                return `🚨 ${baseName} (Avalanche L1)`
            }
            return baseName
        }

        // Fallback: some datasets use 301xx style endpoint IDs while the map might store 1xx
        const numeric = Number(chainId)
        if (!Number.isNaN(numeric) && numeric >= 30000) {
            const maybeCoreId = String(numeric - 30000)
            const alt = layerZeroIdsMap.get(maybeCoreId)
            if (alt) {
                const baseName = alt.name ?? `LZ ${chainId}`
                if (alt.isAvalanche) {
                    return `🚨 ${baseName} (Avalanche L1)`
                }
                return baseName
            }
        }

        // Final fallback to a tiny hardcoded map or generic label
        const fallback = LAYERZERO_CHAINS[chainId]
        return fallback || `LZ ${chainId}`
    }
    // For ICM, use the chain lookup if available
    if (chainLookup && chainLookup.has(chainId)) {
        return chainLookup.get(chainId)!
    }
    // Return full blockchain ID without truncation
    return chainId
}

export default function MessagingComparison() {
    const now = Math.floor(Date.now() / 1000)
    const [startTs, setStartTs] = useState<number>(now - 90 * 86400) // Default: last 3 months
    const [endTs, setEndTs] = useState<number>(now)

    const { data, error, isError, isLoading } = useQuery<DetailedChainComparison[]>({
        queryKey: ['messagingComparisonDetailed', startTs, endTs],
        queryFn: async () => {
            const response = await fetch(
                `${window.location.origin}/api/global/messaging/comparison/detailed?startTs=${startTs}&endTs=${endTs}`
            )

            if (!response.ok) {
                throw new Error('Failed to fetch messaging comparison data')
            }

            return await response.json()
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load messaging comparison data'} />
    }

    // Build a map of blockchain IDs to chain names from ALL chains in the API response
    const chainsByBlockchainId = new Map<string, string>()

    // First, get all chains data to build the complete lookup
    const { data: allChainsData } = useQuery<Array<{ evmChainId: number; chainName: string; blockchainId: string }>>({
        queryKey: ['allChains'],
        queryFn: async () => {
            const response = await fetch(`${window.location.origin}/api/chains`)
            if (!response.ok) {
                throw new Error('Failed to fetch chains data')
            }
            return await response.json()
        }
    })

    // Build the lookup map
    allChainsData?.forEach(chain => {
        chainsByBlockchainId.set(chain.blockchainId, chain.chainName)
    })

    for (const [blockchainId, chainName] of Object.entries(WELL_KNOWN_CHAINS)) {
        if (!chainsByBlockchainId.has(blockchainId)) {
            chainsByBlockchainId.set(blockchainId, chainName)
        }
    }

    // Transform data into table rows (combine inbound and outbound for each pair)
    const tableRows: TableRow[] = []
    data?.forEach(chain => {
        chain.chainPairs.forEach(pair => {
            if (pair.total > 0) {
                const pairChainName = formatChainId(pair.otherChainId, pair.protocol, chainsByBlockchainId)
                tableRows.push({
                    chains: `${chain.chainName} ↔ ${pairChainName}`,
                    protocol: pair.protocol,
                    count: pair.total
                })
            }
        })
    })

    // Sort by message count descending
    tableRows.sort((a, b) => b.count - a.count)

    // Calculate totals
    const totals = data?.reduce((acc, chain) => ({
        layerzero: acc.layerzero + chain.layerzeroTotal,
        icm: acc.icm + chain.icmTotal,
        total: acc.total + chain.layerzeroTotal + chain.icmTotal
    }), { layerzero: 0, icm: 0, total: 0 }) || { layerzero: 0, icm: 0, total: 0 }

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📊 Messaging Protocol Comparison</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Cross-Chain Messaging Activity</div>
                    <p className="text-sm mb-3">
                        All cross-chain messages between chains for both ICM and LayerZero protocols:
                    </p>
                    <ul className="space-y-2 mb-4">
                        <li className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS.icm }} />
                            <span><span className="font-semibold">ICM/Teleporter:</span> Avalanche's native Inter-Chain Messaging</span>
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS.layerzero }} />
                            <span><span className="font-semibold">LayerZero V2:</span> Cross-chain messaging protocol</span>
                        </li>
                    </ul>

                    <TimeRangeSelector
                        startTs={startTs}
                        endTs={endTs}
                        onStartTsChange={setStartTs}
                        onEndTsChange={setEndTs}
                    />
                </div>

                {/* Summary Statistics */}
                {data && data.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600">Total Messages</div>
                            <div className="text-2xl font-bold">{totals.total.toLocaleString()}</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600">ICM Messages</div>
                            <div className="text-2xl font-bold text-blue-600">{totals.icm.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">{totals.total > 0 ? `${((totals.icm / totals.total) * 100).toFixed(1)}%` : '0%'}</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-sm text-gray-600">LayerZero Messages</div>
                            <div className="text-2xl font-bold text-purple-600">{totals.layerzero.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">{totals.total > 0 ? `${((totals.layerzero / totals.total) * 100).toFixed(1)}%` : '0%'}</div>
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="text-center py-8">Loading messaging data...</div>
            ) : !data || data.length === 0 || tableRows.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No messaging data available for the selected time range</div>
            ) : (
                <ExampleCard
                    name="Cross-Chain Messages"
                    curlString={`curl -X GET "${window.location.origin}/api/global/messaging/comparison/detailed?startTs=${startTs}&endTs=${endTs}"`}
                >
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Protocol
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Chains
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Messages
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tableRows.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">

                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: PROTOCOL_COLORS[row.protocol] }}
                                                />
                                                <span style={{ color: PROTOCOL_COLORS[row.protocol] }} className="font-medium">
                                                    {row.protocol === 'icm' ? 'ICM' : 'LayerZero'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {row.chains}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-mono">
                                            {row.count.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ExampleCard>
            )}
        </div>
    )
}
