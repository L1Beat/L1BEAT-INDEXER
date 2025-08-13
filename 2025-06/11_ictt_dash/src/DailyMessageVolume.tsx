import { useState } from "react"
import { getApiChains, getApiGlobalMetricsDailyMessageVolume, getApiByEvmChainIdMetricsDailyMessageVolume } from "./client/sdk.gen"
import { type GetApiChainsResponses, type GetApiGlobalMetricsDailyMessageVolumeResponses, type GetApiByEvmChainIdMetricsDailyMessageVolumeResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"

type Chain = GetApiChainsResponses[200][0]
type DailyMessageVolumeData = GetApiGlobalMetricsDailyMessageVolumeResponses[200][0]
type ChainDailyMessageVolumeData = GetApiByEvmChainIdMetricsDailyMessageVolumeResponses[200][0]

function DailyMessageVolumeChart({ days }: { days: number }) {
    const { data, error, isError, isLoading } = useQuery<DailyMessageVolumeData[]>({
        queryKey: ['dailyMessageVolume', days],
        queryFn: async () => {
            const res = await getApiGlobalMetricsDailyMessageVolume({
                query: { days }
            })
            if (res.data) {
                return res.data
            }
            throw new Error('Failed to fetch daily message volume data')
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load daily message volume data'} />
    }

    if (isLoading || !data) {
        return <div className="text-center py-8">Loading chart data...</div>
    }

    const chartData = data.map(item => ({
        ...item,
        formattedDate: new Date(item.timestamp * 1000).toLocaleDateString()
    }))

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                    <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        labelFormatter={(value) => `Date: ${value}`}
                        formatter={(value: number) => [value.toLocaleString(), 'Messages']}
                    />
                    <Line
                        type="monotone"
                        dataKey="messageCount"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function ChainDailyMessageVolumeChart({ selectedChainId, days }: { selectedChainId: number | null, days: number }) {
    const { data, error, isError, isLoading } = useQuery<ChainDailyMessageVolumeData[]>({
        queryKey: ['chainDailyMessageVolume', selectedChainId, days],
        queryFn: async () => {
            if (!selectedChainId) return []
            const res = await getApiByEvmChainIdMetricsDailyMessageVolume({
                path: { evmChainId: String(selectedChainId) },
                query: { days }
            })
            if (res.data) {
                return res.data
            }
            return []
        },
        enabled: !!selectedChainId
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load chain message volume data'} />
    }

    if (isLoading || !data) {
        return <div className="text-center py-8">Loading chain message data...</div>
    }

    const chartData = (data || []).map((item: ChainDailyMessageVolumeData) => ({
        ...item,
        formattedDate: new Date(item.timestamp * 1000).toLocaleDateString()
    }))

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                    <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        labelFormatter={(value) => `Date: ${value}`}
                        formatter={(value: number, name: string) => [
                            value.toLocaleString(),
                            name === 'incomingCount' ? 'Incoming' : 'Outgoing'
                        ]}
                    />
                    <Bar
                        dataKey="incomingCount"
                        stackId="messages"
                        fill="#2563eb"
                        name="Incoming"
                    />
                    <Bar
                        dataKey="outgoingCount"
                        stackId="messages"
                        fill="#7c3aed"
                        name="Outgoing"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export default function DailyMessageVolume() {
    const [days, setDays] = useState<number>(30)
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null)

    const handleDaysChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value) && value > 0) {
            setDays(value)
        }
    }

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
                <h1 className="text-3xl font-bold">📅 Daily Message Volume</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">ICM Message Volume Over Time</div>
                    <p className="text-sm mb-3">
                        View the daily volume of ICM (Inter-Chain Messaging) messages across the entire network:
                    </p>
                    <ul className="space-y-1 mb-4">
                        <li><span className="font-semibold">Cumulative:</span> Total messages across all chains in the network</li>
                        <li><span className="font-semibold">Daily Count:</span> Number of messages processed each day</li>
                        <li><span className="font-semibold">Time Period:</span> Configurable number of days to display</li>
                    </ul>

                    <div className="max-w-xs">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Number of Days
                        </label>
                        <input
                            type="number"
                            value={days}
                            onChange={handleDaysChange}
                            min="1"
                            max="365"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Days to display"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <ExampleCard
                    name="Network-wide Daily Message Volume"
                    curlString={`curl -X GET "${window.location.origin}/api/metrics/dailyMessageVolume?days=${days}"`}
                >
                    <DailyMessageVolumeChart days={days} />
                </ExampleCard>

                <div className="space-y-4">
                    <ExampleCard
                        name="Chain-specific Message Volume (Incoming/Outgoing)"
                        curlString={selectedChainId ? `curl -X GET "${window.location.origin}/api/${selectedChainId}/metrics/dailyMessageVolume?days=${days}"` : `curl -X GET "${window.location.origin}/api/{chainId}/metrics/dailyMessageVolume?days=${days}"`}
                        chains={chains}
                        selectedChainId={selectedChainId}
                        onChainSelect={setSelectedChainId}
                        defaultChainId={779672}
                    >
                        <ChainDailyMessageVolumeChart selectedChainId={selectedChainId} days={days} />
                    </ExampleCard>
                </div>
            </div>
        </div>
    )
}
