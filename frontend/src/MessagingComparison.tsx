import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"

const MONTHS_COUNT = 18;

interface WindowDataPoint {
    fromTs: number
    toTs: number
    layerzero: number
    icm: number
}

interface ChainComparison {
    chainId: number
    chainName: string
    blockchainId: string
    data: WindowDataPoint[]
}

function TotalChart({ data }: { data: WindowDataPoint[] }) {
    const formatDateRange = (fromTs: number, toTs: number) => {
        const from = new Date(fromTs * 1000)
        const to = new Date(toTs * 1000)
        const fromMonth = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const toMonth = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `${fromMonth} - ${toMonth}`
    }

    const chartData = data.map(item => ({
        ...item,
        label: formatDateRange(item.fromTs, item.toTs),
        fullRange: `${new Date(item.fromTs * 1000).toLocaleDateString()} - ${new Date(item.toTs * 1000).toLocaleDateString()}`
    }))

    const maxValue = Math.max(
        ...chartData.flatMap(d => [d.layerzero, d.icm])
    )

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        domain={[0, maxValue > 0 ? 'dataMax' : 10]}
                    />
                    <Tooltip
                        labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                                return payload[0].payload.fullRange
                            }
                            return label
                        }}
                        formatter={(value: number, name: string) => [
                            value.toLocaleString(),
                            name === 'layerzero' ? 'LayerZero' : 'ICM'
                        ]}
                    />
                    <Legend
                        formatter={(value) => value === 'layerzero' ? 'LayerZero' : 'ICM'}
                    />
                    <Line
                        type="monotone"
                        dataKey="layerzero"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ fill: '#8b5cf6', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="icm"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function ChainChart({ chain }: { chain: ChainComparison }) {
    const formatDateRange = (fromTs: number, toTs: number) => {
        const from = new Date(fromTs * 1000)
        const to = new Date(toTs * 1000)
        const fromMonth = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const toMonth = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return `${fromMonth} - ${toMonth}`
    }

    const chartData = chain.data.map(item => ({
        ...item,
        label: formatDateRange(item.fromTs, item.toTs),
        fullRange: `${new Date(item.fromTs * 1000).toLocaleDateString()} - ${new Date(item.toTs * 1000).toLocaleDateString()}`
    }))

    const maxValue = Math.max(
        ...chartData.flatMap(d => [d.layerzero, d.icm])
    )

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        domain={[0, maxValue > 0 ? 'dataMax' : 10]}
                    />
                    <Tooltip
                        labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                                return payload[0].payload.fullRange
                            }
                            return label
                        }}
                        formatter={(value: number, name: string) => [
                            value.toLocaleString(),
                            name === 'layerzero' ? 'LayerZero' : 'ICM'
                        ]}
                    />
                    <Legend
                        formatter={(value) => value === 'layerzero' ? 'LayerZero' : 'ICM'}
                    />
                    <Line
                        type="monotone"
                        dataKey="layerzero"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6', r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="icm"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

function aggregateChainData(chains: ChainComparison[]): WindowDataPoint[] {
    if (chains.length === 0) return []

    // Get all unique time windows from the first chain (they should be the same across all chains)
    const windows = chains[0]?.data || []

    return windows.map(window => {
        let totalLayerZero = 0
        let totalIcm = 0

        // Sum up counts from all chains for this time window
        chains.forEach(chain => {
            const matchingWindow = chain.data.find(w => w.fromTs === window.fromTs && w.toTs === window.toTs)
            if (matchingWindow) {
                totalLayerZero += matchingWindow.layerzero
                totalIcm += matchingWindow.icm
            }
        })

        return {
            fromTs: window.fromTs,
            toTs: window.toTs,
            layerzero: totalLayerZero,
            icm: totalIcm
        }
    })
}

export default function MessagingComparison() {
    const { data, error, isError, isLoading } = useQuery<ChainComparison[]>({
        queryKey: ['messagingComparison'],
        queryFn: async () => {
            const response = await fetch(`${window.location.origin}/api/global/messaging/comparison?count=${MONTHS_COUNT}`)

            if (!response.ok) {
                throw new Error('Failed to fetch messaging comparison data')
            }

            const data = await response.json()
            return data as ChainComparison[]
        }
    })

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load messaging comparison data'} />
    }

    const totalData = data ? aggregateChainData(data) : []

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📊 Messaging Protocol Comparison</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">ICM vs LayerZero Message Volume</div>
                    <p className="text-sm mb-3">
                        Compare messaging activity between Inter-Chain Messaging (ICM) and LayerZero protocols across different chains:
                    </p>
                    <ul className="space-y-2">
                        <li>
                            <span className="font-semibold text-blue-600">ICM/Teleporter (Blue):</span> Avalanche's native Inter-Chain Messaging protocol
                            <ul className="ml-6 mt-1 text-xs space-y-1">
                                <li>• Contract: <code>0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf</code></li>
                                <li>• Events tracked: <code>SendCrossChainMessage</code> (outgoing) and <code>ReceiveCrossChainMessage</code> (incoming)</li>
                            </ul>
                        </li>
                        <li>
                            <span className="font-semibold text-purple-600">LayerZero V2 (Purple):</span> Cross-chain messaging protocol
                            <ul className="ml-6 mt-1 text-xs space-y-1">
                                <li>• Events tracked: <code>PacketSent</code> (outgoing) and <code>PacketDelivered</code> (incoming)</li>
                                <li>• From LayerZero Endpoint V2 contracts deployed on each chain</li>
                            </ul>
                        </li>
                        <li><span className="font-semibold">Time Windows:</span> Last {MONTHS_COUNT} months, each showing a 30-day rolling window</li>
                        <li><span className="font-semibold">Data Points:</span> Message counts aggregated per 30-day period from indexed events</li>
                    </ul>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8">Loading messaging data...</div>
            ) : !data || data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No messaging data available</div>
            ) : (
                <>
                    {/* Total across all chains */}
                    <div className="mb-8">
                        <ExampleCard
                            name="Network Total (All Chains Combined)"
                            curlString={`curl -X GET "${window.location.origin}/api/global/messaging/comparison?count=${MONTHS_COUNT}"`}
                        >
                            <TotalChart data={totalData} />
                        </ExampleCard>
                    </div>

                    {/* Individual chain charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {data.map(chain => (
                            <ExampleCard
                                key={chain.chainId}
                                name={chain.chainName}
                                curlString={`curl -X GET "${window.location.origin}/api/global/messaging/comparison?count=${MONTHS_COUNT}"`}
                            >
                                <ChainChart chain={chain} />
                            </ExampleCard>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
