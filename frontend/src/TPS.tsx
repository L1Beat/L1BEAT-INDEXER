import { useState } from "react"
import { getApiChains, getApiByEvmChainIdStatsTps, getApiGlobalStatsTps } from "./client/sdk.gen"
import { type GetApiChainsResponses, type GetApiByEvmChainIdStatsTpsResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Chain = GetApiChainsResponses[200][0]
type TPSData = GetApiByEvmChainIdStatsTpsResponses[200]

interface ChartDataPoint {
    time: string
    timestamp: number
    tps: number
}

function TPSChart({ selectedChainId, period }: { selectedChainId: number | null, period: '1h' | '1d' | '7d' | '30d' }) {
    const periodToCount = {
        '1h': 12,
        '1d': 30,
        '7d': 168,
        '30d': 720
    }

    const { data: tpsData, isLoading, error } = useQuery({
        queryKey: ['tps', selectedChainId, period],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await getApiByEvmChainIdStatsTps({
                path: { evmChainId: String(selectedChainId) },
                query: { count: periodToCount[period] }
            })
            return res.data
        },
        enabled: !!selectedChainId
    })

    const formatTime = (timestamp: number): string => {
        const date = new Date(timestamp * 1000)
        if (isNaN(date.getTime())) {
            return 'Invalid Date'
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        })
    }

    const transformDataForChart = (data: TPSData): ChartDataPoint[] => {
        if (!data) return []

        return data.map(point => ({
            time: formatTime(point.timestamp),
            timestamp: point.timestamp,
            tps: point.tps
        })).sort((a, b) => a.timestamp - b.timestamp)
    }

    const chartData = transformDataForChart(tpsData || [])

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading TPS data</div>
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading TPS data...</div>
    }

    if (!tpsData || tpsData.length === 0) {
        return <div className="text-center py-8 text-gray-500">No TPS data available</div>
    }

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Transactions Per Second', angle: -90, position: 'insideLeft' }}
                        domain={[0, 'dataMax']}
                    />
                    <Tooltip
                        formatter={(value: number) => [
                            `${Number(value).toFixed(2)} TPS`,
                            'TPS'
                        ]}
                        labelFormatter={(label: string) => `Time: ${label}`}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="tps"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="TPS"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function NetworkTPSChart({ period }: { period: '1h' | '1d' | '7d' | '30d' }) {
    const { data: tpsData, isLoading, error } = useQuery({
        queryKey: ['networkTps', period],
        queryFn: async () => {
            const res = await getApiGlobalStatsTps({
                query: { period }
            })
            return res.data
        }
    })

    const chartData = tpsData?.map(chain => ({
        name: chain.name || `Chain ${chain.evmChainId}`,
        tps: chain.tps,
        txs: chain.txs
    })).sort((a, b) => b.tps - a.tps) || []

    if (error) {
        return <div className="text-center py-8 text-red-600">Error loading network TPS data</div>
    }

    if (isLoading) {
        return <div className="text-center py-8">Loading network TPS data...</div>
    }

    if (!tpsData || tpsData.length === 0) {
        return <div className="text-center py-8 text-gray-500">No network TPS data available</div>
    }

    return (
        <div className="overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                {chartData.map((chain, index) => (
                    <div key={chain.name} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium text-gray-500 w-8">{index + 1}.</span>
                            <span className="text-sm font-medium text-gray-900 truncate">{chain.name}</span>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                            <span className="text-sm font-semibold text-gray-900">{chain.tps.toFixed(2)} TPS</span>
                            <span className="text-xs text-gray-500">({chain.txs.toLocaleString()} txs)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function TPS() {
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
    const [period, setPeriod] = useState<'1h' | '1d' | '7d' | '30d'>('1d')

    const { data: chains = [], error, isError } = useQuery<Chain[]>({
        queryKey: ['chains'],
        queryFn: async () => {
            const res = await getApiChains()
            if (res.data) {
                return res.data.sort((a, b) => a.chainName.localeCompare(b.chainName))
            }
            throw new Error('Failed to fetch chains')
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load chain data'} />
    }

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📈 TPS</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Transactions Per Second (TPS)</div>
                    <p className="text-sm mb-3">
                        Track transaction throughput performance over time:
                    </p>
                    <ul className="space-y-1 mb-3">
                        <li><span className="font-semibold">TPS:</span> Number of transactions processed per second</li>
                        <li><span className="font-semibold">Time Intervals:</span> Data aggregated over time periods</li>
                        <li><span className="font-semibold">Performance:</span> Higher TPS indicates better network throughput</li>
                    </ul>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPeriod('1h')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${period === '1h'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            1 Hour
                        </button>
                        <button
                            onClick={() => setPeriod('1d')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${period === '1d'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            1 Day
                        </button>
                        <button
                            onClick={() => setPeriod('7d')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${period === '7d'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setPeriod('30d')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${period === '30d'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            30 Days
                        </button>
                    </div>
                    <ExampleCard
                        name="Network-wide TPS Leaderboard"
                        curlString={`curl -X GET "${window.location.origin}/api/stats/tps?period=${period}"`}
                    >
                        <NetworkTPSChart period={period} />
                    </ExampleCard>
                </div>

                <div className="space-y-4">
                    <ExampleCard
                        name="Single chain TPS Daily"
                        curlString={`curl -X GET "${window.location.origin}/api/${selectedChainId || '{chainId}'}/stats/tps?count=${period === '1h' ? 12 : period === '1d' ? 30 : period === '7d' ? 168 : 720}"`}
                        chains={chains}
                        selectedChainId={selectedChainId}
                        onChainSelect={setSelectedChainId}
                        defaultChainId={16180}
                    >
                        <TPSChart selectedChainId={selectedChainId} period={period} />
                    </ExampleCard>
                </div>
            </div>
        </div>
    )
}
