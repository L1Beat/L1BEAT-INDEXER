
import { useState, useEffect } from "react"
import { getApiChains, getApiByEvmChainIdStatsCumulativeTxs, getApiByEvmChainIdStatsActiveAddressesPeriod, getApiByEvmChainIdStatsGasUsagePeriod, getApiByEvmChainIdStatsIcmMessagesTotal } from "./client/sdk.gen"
import { type GetApiChainsResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ErrorComponent from "./components/ErrorComponent"

type Chain = GetApiChainsResponses[200][0]

interface ChainStats {
    chain: Chain
    period1: {
        totalTxs: number
        dailyTxs: number
        totalActiveAddresses: number
        avgDailyActiveAddresses: number
        avgDailyGasUsed: number
        icmMessagesInPeriod: number
    }
    period2: {
        totalTxs: number
        dailyTxs: number
        totalActiveAddresses: number
        avgDailyActiveAddresses: number
        avgDailyGasUsed: number
        icmMessagesInPeriod: number
    }
    loading: boolean
    error?: string
}

export default function ChainComparison() {
    // Default dates as Unix timestamps - using more recent dates for your active chains
    const [period1Start, setPeriod1Start] = useState<number>(Math.floor(new Date('2024-12-01').getTime() / 1000))
    const [period1End, setPeriod1End] = useState<number>(Math.floor(new Date('2024-12-31').getTime() / 1000))
    const [period2Start, setPeriod2Start] = useState<number>(Math.floor(new Date('2025-01-01').getTime() / 1000))
    const [period2End, setPeriod2End] = useState<number>(Math.floor(new Date('2025-01-13').getTime() / 1000))

    // Pre-select your active chains
    const [selectedChains, setSelectedChains] = useState<Set<number>>(new Set([
        779672, 16180, 173750, 8021, 379, 741741 // Your most active chains
    ]))
    const [chainStats, setChainStats] = useState<Map<number, ChainStats>>(new Map())

    const { data: chains = [], error: chainsError, isError: chainsIsError } = useQuery<Chain[]>({
        queryKey: ['chains'],
        queryFn: async () => {
            const res = await getApiChains()
            if (res.data) {
                return res.data.sort((a, b) => a.chainName.localeCompare(b.chainName))
            }
            throw new Error('Failed to fetch chains')
        }
    })

    const toggleChain = (evmChainId: number) => {
        const newSelected = new Set(selectedChains)
        if (newSelected.has(evmChainId)) {
            newSelected.delete(evmChainId)
            const newStats = new Map(chainStats)
            newStats.delete(evmChainId)
            setChainStats(newStats)
        } else {
            newSelected.add(evmChainId)
        }
        setSelectedChains(newSelected)
    }

    const formatTimestampForInput = (ts: number): string => {
        try {
            if (ts === 0) return new Date(0).toISOString().slice(0, 16)
            const date = new Date(ts * 1000)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().slice(0, 16)
        } catch {
            return ''
        }
    }

    const handlePeriod1StartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                setPeriod1Start(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    const handlePeriod1EndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                setPeriod1End(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    const handlePeriod2StartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                setPeriod2Start(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    const handlePeriod2EndChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const dateTime = new Date(event.target.value)
            if (!isNaN(dateTime.getTime())) {
                setPeriod2End(Math.floor(dateTime.getTime() / 1000))
            }
        } catch {
            // Ignore invalid dates
        }
    }

    // Clear chain stats when dates change to force refetch
    useEffect(() => {
        try {
            const p1Start = new Date(period1Start * 1000)
            const p1End = new Date(period1End * 1000)
            const p2Start = new Date(period2Start * 1000)
            const p2End = new Date(period2End * 1000)

            const datesValid = !isNaN(p1Start.getTime()) &&
                !isNaN(p1End.getTime()) &&
                !isNaN(p2Start.getTime()) &&
                !isNaN(p2End.getTime()) &&
                period1Start < period1End &&
                period2Start < period2End

            if (datesValid) {
                setChainStats(new Map())
            }
        } catch {
            // Ignore invalid dates
        }
    }, [period1Start, period1End, period2Start, period2End])

    // Fetch stats for selected chains
    useEffect(() => {
        const fetchStats = async (chain: Chain) => {
            setChainStats(prev => new Map(prev).set(chain.evmChainId, {
                chain,
                period1: { totalTxs: 0, dailyTxs: 0, totalActiveAddresses: 0, avgDailyActiveAddresses: 0, avgDailyGasUsed: 0, icmMessagesInPeriod: 0 },
                period2: { totalTxs: 0, dailyTxs: 0, totalActiveAddresses: 0, avgDailyActiveAddresses: 0, avgDailyGasUsed: 0, icmMessagesInPeriod: 0 },
                loading: true
            }))

            try {
                // Fetch cumulative txs, active addresses, gas usage, and ICM messages data in parallel
                // All APIs now use clean chain ID format (e.g., "16180")
                const chainIdStr = String(chain.evmChainId) as any;
                
                const [p1Start, p1End, p2Start, p2End, p1ActiveAddresses, p2ActiveAddresses, p1GasUsage, p2GasUsage, icmP1Start, icmP1End, icmP2Start, icmP2End] = await Promise.all([
                    // Cumulative transactions API (now uses clean format)
                    getApiByEvmChainIdStatsCumulativeTxs({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period1Start }
                    }),
                    getApiByEvmChainIdStatsCumulativeTxs({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period1End }
                    }),
                    getApiByEvmChainIdStatsCumulativeTxs({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period2Start }
                    }),
                    getApiByEvmChainIdStatsCumulativeTxs({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period2End }
                    }),
                    // Active addresses API
                    getApiByEvmChainIdStatsActiveAddressesPeriod({
                        path: { evmChainId: chainIdStr },
                        query: { startTimestamp: period1Start, endTimestamp: period1End }
                    }).then((res: any) => res.data || { totalActiveAddresses: 0, avgDailyActiveAddresses: 0, totalTransactions: 0 })
                        .catch(() => ({ totalActiveAddresses: 0, avgDailyActiveAddresses: 0, totalTransactions: 0 })),
                    getApiByEvmChainIdStatsActiveAddressesPeriod({
                        path: { evmChainId: chainIdStr },
                        query: { startTimestamp: period2Start, endTimestamp: period2End }
                    }).then((res: any) => res.data || { totalActiveAddresses: 0, avgDailyActiveAddresses: 0, totalTransactions: 0 })
                        .catch(() => ({ totalActiveAddresses: 0, avgDailyActiveAddresses: 0, totalTransactions: 0 })),
                    // Gas usage API
                    getApiByEvmChainIdStatsGasUsagePeriod({
                        path: { evmChainId: chainIdStr },
                        query: { startTimestamp: period1Start, endTimestamp: period1End }
                    }).then((res: any) => res.data || { avgDailyGasUsed: 0 })
                        .catch(() => ({ avgDailyGasUsed: 0 })),
                    getApiByEvmChainIdStatsGasUsagePeriod({
                        path: { evmChainId: chainIdStr },
                        query: { startTimestamp: period2Start, endTimestamp: period2End }
                    }).then((res: any) => res.data || { avgDailyGasUsed: 0 })
                        .catch(() => ({ avgDailyGasUsed: 0 })),
                    // ICM messages API
                    getApiByEvmChainIdStatsIcmMessagesTotal({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period1Start }
                    }).then((res: any) => res.data || { totalMessages: 0 })
                        .catch(() => ({ totalMessages: 0 })),
                    getApiByEvmChainIdStatsIcmMessagesTotal({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period1End }
                    }).then((res: any) => res.data || { totalMessages: 0 })
                        .catch(() => ({ totalMessages: 0 })),
                    getApiByEvmChainIdStatsIcmMessagesTotal({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period2Start }
                    }).then((res: any) => res.data || { totalMessages: 0 })
                        .catch(() => ({ totalMessages: 0 })),
                    getApiByEvmChainIdStatsIcmMessagesTotal({
                        path: { evmChainId: chainIdStr },
                        query: { timestamp: period2End }
                    }).then((res: any) => res.data || { totalMessages: 0 })
                        .catch(() => ({ totalMessages: 0 }))
                ])

                const period1StartTxs = p1Start.data?.cumulativeTxs || 0
                const period1TotalTxs = p1End.data?.cumulativeTxs || 0
                const period2StartTxs = p2Start.data?.cumulativeTxs || 0
                const period2TotalTxs = p2End.data?.cumulativeTxs || 0

                const period1TxsInPeriod = period1TotalTxs - period1StartTxs
                const period2TxsInPeriod = period2TotalTxs - period2StartTxs

                const period1Days = Math.ceil((period1End - period1Start) / 86400)
                const period2Days = Math.ceil((period2End - period2Start) / 86400)

                const icmP1StartMessages = icmP1Start.totalMessages || 0
                const icmP1EndMessages = icmP1End.totalMessages || 0
                const icmP2StartMessages = icmP2Start.totalMessages || 0
                const icmP2EndMessages = icmP2End.totalMessages || 0

                const icmP1MessagesInPeriod = icmP1EndMessages - icmP1StartMessages
                const icmP2MessagesInPeriod = icmP2EndMessages - icmP2StartMessages

                setChainStats(prev => new Map(prev).set(chain.evmChainId, {
                    chain,
                    period1: {
                        totalTxs: period1TotalTxs,
                        dailyTxs: period1TxsInPeriod / period1Days,
                        totalActiveAddresses: p1ActiveAddresses.totalActiveAddresses || 0,
                        avgDailyActiveAddresses: p1ActiveAddresses.avgDailyActiveAddresses || 0,
                        avgDailyGasUsed: p1GasUsage.avgDailyGasUsed || 0,
                        icmMessagesInPeriod: icmP1MessagesInPeriod
                    },
                    period2: {
                        totalTxs: period2TotalTxs,
                        dailyTxs: period2TxsInPeriod / period2Days,
                        totalActiveAddresses: p2ActiveAddresses.totalActiveAddresses || 0,
                        avgDailyActiveAddresses: p2ActiveAddresses.avgDailyActiveAddresses || 0,
                        avgDailyGasUsed: p2GasUsage.avgDailyGasUsed || 0,
                        icmMessagesInPeriod: icmP2MessagesInPeriod
                    },
                    loading: false
                }))
            } catch (error) {
                setChainStats(prev => new Map(prev).set(chain.evmChainId, {
                    chain,
                    period1: { totalTxs: 0, dailyTxs: 0, totalActiveAddresses: 0, avgDailyActiveAddresses: 0, avgDailyGasUsed: 0, icmMessagesInPeriod: 0 },
                    period2: { totalTxs: 0, dailyTxs: 0, totalActiveAddresses: 0, avgDailyActiveAddresses: 0, avgDailyGasUsed: 0, icmMessagesInPeriod: 0 },
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch data'
                }))
            }
        }

        // Fetch stats for newly selected chains - only if dates are valid
        if (hasValidDates()) {
            selectedChains.forEach(evmChainId => {
                if (!chainStats.has(evmChainId)) {
                    const chain = chains.find(c => c.evmChainId === evmChainId)
                    if (chain) {
                        fetchStats(chain)
                    }
                }
            })
        }
    }, [selectedChains, chains, chainStats, period1Start, period1End, period2Start, period2End])

    if (chainsIsError) {
        return <ErrorComponent message={chainsError?.message || 'Failed to load chain data'} />
    }

    const formatDate = (timestamp: number): string => {
        try {
            const date = new Date(timestamp * 1000)
            if (isNaN(date.getTime())) return 'Invalid Date'
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        } catch {
            return 'Invalid Date'
        }
    }

    const formatDateRange = (startTs: number, endTs: number): string => {
        try {
            const startFormatted = formatDate(startTs)
            const endFormatted = formatDate(endTs)
            if (startFormatted === 'Invalid Date' || endFormatted === 'Invalid Date') {
                return 'Invalid Date Range'
            }
            return `${startFormatted} - ${endFormatted}`
        } catch {
            return 'Invalid Date Range'
        }
    }

    // Check if dates are valid
    const hasValidDates = () => {
        try {
            const p1Start = new Date(period1Start * 1000)
            const p1End = new Date(period1End * 1000)
            const p2Start = new Date(period2Start * 1000)
            const p2End = new Date(period2End * 1000)

            return !isNaN(p1Start.getTime()) &&
                !isNaN(p1End.getTime()) &&
                !isNaN(p2Start.getTime()) &&
                !isNaN(p2End.getTime()) &&
                period1Start < period1End &&
                period2Start < period2End
        } catch {
            return false
        }
    }

    return (
        <div className="py-8 px-4 md:px-8">
            <h1 className="text-3xl font-bold mb-6">📊 L1BEAT INDEXER Chain Comparison Dashboard</h1>
            <p className="text-gray-600 mb-6">
                Compare metrics across your indexed Avalanche L1 chains between two time periods. 
                Uses all your advanced analytics APIs: transactions, active addresses, gas usage, and ICM messaging.
            </p>

            {/* Period Settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">📅 Period Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-medium mb-3">Period 1: {formatDateRange(period1Start, period1End)}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="datetime-local"
                                    value={formatTimestampForInput(period1Start)}
                                    onChange={handlePeriod1StartChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input
                                    type="datetime-local"
                                    value={formatTimestampForInput(period1End)}
                                    onChange={handlePeriod1EndChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-medium mb-3">Period 2: {formatDateRange(period2Start, period2End)}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="datetime-local"
                                    value={formatTimestampForInput(period2Start)}
                                    onChange={handlePeriod2StartChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input
                                    type="datetime-local"
                                    value={formatTimestampForInput(period2End)}
                                    onChange={handlePeriod2EndChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chain Selection */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">⛓️ Select Chains</h2>
                <p className="text-gray-600 text-sm mb-4">Choose which Avalanche L1 chains to analyze and compare.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {chains.map(chain => (
                        <label
                            key={chain.evmChainId}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                            <input
                                type="checkbox"
                                checked={selectedChains.has(chain.evmChainId)}
                                onChange={() => toggleChain(chain.evmChainId)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm">
                                {chain.chainName}
                                <span className="text-xs text-gray-500 ml-1">({chain.evmChainId})</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Chain Stats Cards */}
            {!hasValidDates() ? (
                <div className="bg-white border border-red-200 rounded-xl p-6">
                    <div className="text-center py-8 text-red-600">
                        <h3 className="text-lg font-semibold mb-2">⚠️ Invalid Date Configuration</h3>
                        <p>Please ensure all dates are valid and that start dates are before end dates.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {Array.from(selectedChains).map(evmChainId => {
                        const stats = chainStats.get(evmChainId)
                        if (!stats) return null

                        return (
                            <div key={evmChainId} className="bg-white border border-gray-200 rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-4">
                                    🔗 {stats.chain.chainName}
                                    <span className="text-sm text-gray-500 ml-2">Chain ID: {evmChainId}</span>
                                </h3>

                                {stats.loading ? (
                                    <div className="text-center py-8 text-gray-500">⏳ Loading analytics data...</div>
                                ) : stats.error ? (
                                    <div className="text-center py-8 text-red-500">❌ Error: {stats.error}</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2 px-4">📊 Metric</th>
                                                    <th className="text-right py-2 px-4 text-sm">{formatDateRange(period1Start, period1End)}</th>
                                                    <th className="text-right py-2 px-4 text-sm">{formatDateRange(period2Start, period2End)}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">📈 Total Transactions (end of period)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period1.totalTxs.toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period2.totalTxs.toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">📊 Daily Transactions (avg)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period1.dailyTxs).toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period2.dailyTxs).toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">👥 Active Addresses (during period)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period1.totalActiveAddresses.toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period2.totalActiveAddresses.toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">📅 Daily Active Users (avg)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period1.avgDailyActiveAddresses).toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period2.avgDailyActiveAddresses).toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">⛽ Daily Gas Used (avg)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period1.avgDailyGasUsed).toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {Math.round(stats.period2.avgDailyGasUsed).toLocaleString()}
                                                    </td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3 px-4">📨 ICM Messages (sent/received in period)</td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period1.icmMessagesInPeriod.toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-3 px-4 font-mono">
                                                        {stats.period2.icmMessagesInPeriod.toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {selectedChains.size === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            📋 Select chains above to view their comprehensive analytics
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
