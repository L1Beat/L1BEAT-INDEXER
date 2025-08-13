import { useState } from "react"
import { getApiGlobalIcttTransfersList } from "./client/sdk.gen"
import { type GetApiGlobalIcttTransfersListResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"
import NamedCoin from "./components/NamedCoin"
import TimeTimestamp from "./components/TimeTimestamp"
import ShortHash from "./components/ShortHash"

type TransferListData = GetApiGlobalIcttTransfersListResponses[200]

export default function ICTTTransfersList() {
    const [startTs, setStartTs] = useState<number>(0)
    const [endTs, setEndTs] = useState<number>(Math.floor(Date.now() / 1000))
    const [homeChain, setHomeChain] = useState<string>("")
    const [remoteChain, setRemoteChain] = useState<string>("")
    const [contractAddress, setContractAddress] = useState<string>("")
    const [coinAddress, setCoinAddress] = useState<string>("")

    const { data, error, isError, isLoading } = useQuery<TransferListData>({
        queryKey: ['icttTransfersList', startTs, endTs, homeChain, remoteChain, contractAddress, coinAddress],
        queryFn: async () => {
            const res = await getApiGlobalIcttTransfersList({
                query: {
                    startTs,
                    endTs,
                    ...(homeChain && { homeChain }),
                    ...(remoteChain && { remoteChain }),
                    ...(contractAddress && { contractAddress }),
                    ...(coinAddress && { coinAddress })
                }
            })
            if (res.data) {
                return res.data
            }
            throw new Error('Failed to fetch ICTT transfers list')
        }
    })

    const formatTimestampForInput = (ts: number): string => {
        if (ts === 0) return new Date(0).toISOString().slice(0, 16)
        return new Date(ts * 1000).toISOString().slice(0, 16)
    }

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

    const handleStartDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        setStartTs(Math.floor(dateTime.getTime() / 1000))
    }

    const handleEndDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        setEndTs(Math.floor(dateTime.getTime() / 1000))
    }

    if (isError) {
        return <ErrorComponent message={error?.message || 'Failed to load ICTT transfers list'} />
    }

    const transfers = data?.transfers || []
    const totalCount = data?.totalCount || 0
    const availableChains = data?.availableChains || []
    const moreItems = totalCount - transfers.length

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📋 ICTT Transfers List</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Individual ICTT Transfer Records</div>
                    <p className="text-sm mb-4">
                        View individual token transfer records with filtering options.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Home Chain
                            </label>
                            <select
                                value={homeChain}
                                onChange={(e) => setHomeChain(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Chains</option>
                                {availableChains.map(chain => (
                                    <option key={chain.blockchainId} value={chain.blockchainId}>
                                        {chain.chainName !== chain.blockchainId ? chain.chainName : chain.blockchainId}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Remote Chain
                            </label>
                            <select
                                value={remoteChain}
                                onChange={(e) => setRemoteChain(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Chains</option>
                                {availableChains.map(chain => (
                                    <option key={chain.blockchainId} value={chain.blockchainId}>
                                        {chain.chainName !== chain.blockchainId ? chain.chainName : chain.blockchainId}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Home Contract Address
                            </label>
                            <input
                                type="text"
                                value={contractAddress}
                                onChange={(e) => setContractAddress(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0x..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Coin Address
                            </label>
                            <input
                                type="text"
                                value={coinAddress}
                                onChange={(e) => setCoinAddress(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0x..."
                            />
                        </div>

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
                name="ICTT Transfer Records"
                curlString={`curl -X GET "${window.location.origin}/api/ictt/transfers-list?startTs=${startTs}&endTs=${endTs}${homeChain ? `&homeChain=${homeChain}` : ''}${remoteChain ? `&remoteChain=${remoteChain}` : ''}${contractAddress ? `&contractAddress=${contractAddress}` : ''}${coinAddress ? `&coinAddress=${coinAddress}` : ''}"`}
            >
                {isLoading ? (
                    <div className="text-center py-8">Loading transfers...</div>
                ) : transfers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No transfers found matching the filters</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Time
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Home Chain
                                        </th>
                                        <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Remote Chain
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Contract Address
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Coin Address
                                        </th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Amount
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            TX Hash
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {transfers.map((transfer, index) => {
                                        const showHomeChainId = transfer.homeChainName === transfer.homeChainBlockchainId
                                        const showRemoteChainId = transfer.remoteChainName === transfer.remoteChainBlockchainId
                                        const arrow = transfer.direction === 'out' ? '→' : '←'

                                        const homeDisplay = showHomeChainId ? transfer.homeChainBlockchainId : transfer.homeChainName
                                        const remoteDisplay = showRemoteChainId ? transfer.remoteChainBlockchainId : transfer.remoteChainName

                                        return (
                                            <tr key={`transfer-${index}`} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-sm text-gray-600">
                                                    <TimeTimestamp timestamp={transfer.blockTimestamp} />
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                    <span className={showHomeChainId ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                                        {homeDisplay}
                                                    </span>
                                                </td>
                                                <td className="px-1 py-2 text-center">
                                                    <span className={`font-bold text-lg ${transfer.direction === 'out' ? 'text-red-600' : 'text-green-600'}`}>
                                                        {arrow}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                    <span className={showRemoteChainId ? "font-mono text-gray-600" : "font-medium text-gray-900"}>
                                                        {remoteDisplay}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-sm font-mono text-gray-600">
                                                    <ShortHash hash={transfer.contractAddress} />
                                                </td>
                                                <td className="px-3 py-2 text-sm font-mono text-gray-600">
                                                    <NamedCoin
                                                        address={transfer.coinAddress}
                                                        extras={{
                                                            "0x0000000000000000000000000000000000000000": `${transfer.homeChainName} Native Token`
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">
                                                    {transfer.amount.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-mono text-gray-600">
                                                    <ShortHash hash={transfer.txHash} />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {moreItems > 0 && (
                            <div className="text-center py-4 text-gray-600">
                                {moreItems.toLocaleString()} more items
                            </div>
                        )}
                    </>
                )}
            </ExampleCard>
        </div>
    )
}
