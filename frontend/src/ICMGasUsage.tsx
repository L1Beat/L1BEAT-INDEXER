import { useState } from "react"
import { getApiGlobalIcmGasUsage } from "./client/sdk.gen"
import { type GetApiGlobalIcmGasUsageResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"

type GasUsageData = GetApiGlobalIcmGasUsageResponses[200][0]

export default function ICMGasUsage() {
    const [startTs, setStartTs] = useState<number>(Math.floor(Date.now() / 1000) - 30 * 86400)
    const [endTs, setEndTs] = useState<number>(Math.floor(Date.now() / 1000))

    const { data, error, isError, isLoading } = useQuery<GasUsageData[]>({
        queryKey: ['icmGasUsage', startTs, endTs],
        queryFn: async () => {
            const res = await getApiGlobalIcmGasUsage({
                query: { startTs, endTs }
            })
            if (res.data) {
                return res.data
            }
            throw new Error('Failed to fetch ICM gas usage data')
        }
    })

    const handleStartTsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value) && value >= 0) {
            setStartTs(value)
        }
    }

    const handleEndTsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value) && value >= 0) {
            setEndTs(value)
        }
    }

    const formatTimestampForInput = (ts: number): string => {
        if (ts === 0) return new Date(0).toISOString().slice(0, 16)
        return new Date(ts * 1000).toISOString().slice(0, 16)
    }

    const handleStartDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        setStartTs(Math.floor(dateTime.getTime() / 1000))
    }

    const handleEndDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        setEndTs(Math.floor(dateTime.getTime() / 1000))
    }

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load ICM gas usage data'} />
    }

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📊 ICM Gas Usage</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Inter-Chain Messaging Gas Usage</div>
                    <p className="text-sm mb-3">
                        Track gas costs for sending and receiving cross-chain messages:
                    </p>
                    <ul className="space-y-1 mb-4">
                        <li><span className="font-semibold">Chain:</span> The chain where gas is consumed</li>
                        <li><span className="font-semibold">Other Chain:</span> The partner chain in the messaging</li>
                        <li><span className="font-semibold">Send Count/Gas:</span> Outgoing messages from this chain (gas paid in this chain's native token)</li>
                        <li><span className="font-semibold">Receive Count/Gas:</span> Incoming messages to this chain (gas paid in this chain's native token)</li>
                        <li><span className="font-semibold">Total:</span> Combined send and receive activity on this chain</li>
                    </ul>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Time
                            </label>
                            <input
                                type="datetime-local"
                                value={formatTimestampForInput(startTs)}
                                onChange={handleStartDateTimeChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="number"
                                value={startTs}
                                onChange={handleStartTsChange}
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Unix timestamp"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Time
                            </label>
                            <input
                                type="datetime-local"
                                value={formatTimestampForInput(endTs)}
                                onChange={handleEndDateTimeChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="number"
                                value={endTs}
                                onChange={handleEndTsChange}
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Unix timestamp"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <ExampleCard
                name="ICM Gas Usage by Chain"
                curlString={`curl -X GET "${window.location.origin}/api/global/icm-gas-usage?startTs=${startTs}&endTs=${endTs}"`}
            >
                {isLoading ? (
                    <div className="text-center py-8">Loading gas usage data...</div>
                ) : !data || data.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No gas usage data found in the selected time range</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Chain
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Other Chain
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Send Count
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Send Gas
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Receive Count
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Receive Gas
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Count
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Gas
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.map((row, index) => {
                                    const showChainId = row.chainName === row.chainBlockchainId;
                                    const showOtherChainId = row.otherChainName === row.otherChainBlockchainId;
                                    const chainDisplay = showChainId ? row.chainBlockchainId : row.chainName;
                                    const otherChainDisplay = showOtherChainId ? row.otherChainBlockchainId : row.otherChainName;

                                    return (
                                        <tr key={`${row.chainBlockchainId}-${row.otherChainBlockchainId}-${index}`} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-sm">
                                                <span className={showChainId ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                                    {chainDisplay}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                <span className={showOtherChainId ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                                    {otherChainDisplay}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                                                {row.sendCount.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-mono">
                                                {row.sendGasCost.toFixed(4)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                                                {row.receiveCount.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-mono">
                                                {row.receiveGasCost.toFixed(4)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                                                {row.totalCount.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium font-mono">
                                                {row.totalGasCost.toFixed(4)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </ExampleCard>
        </div>
    )
}
