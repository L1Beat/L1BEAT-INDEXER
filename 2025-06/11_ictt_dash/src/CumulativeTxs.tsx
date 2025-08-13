import { useState, useEffect } from "react"
import { getApiChains, getApiByEvmChainIdStatsCumulativeTxs } from "./client/sdk.gen"
import { type GetApiChainsResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"

type Chain = GetApiChainsResponses[200][0]

interface ChainWithTxs extends Chain {
    cumulativeTxs?: number
    timestamp?: number
    loading?: boolean
    error?: string
}

function CumulativeTxsList({ timestamp }: { timestamp: number }) {
    const [chainsWithTxs, setChainsWithTxs] = useState<ChainWithTxs[]>([])

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

    useEffect(() => {
        if (chains.length === 0) return

        setChainsWithTxs(chains.map(chain => ({ ...chain, loading: true })))

        const fetchCumulativeTxs = async () => {
            const results = await Promise.allSettled(
                chains.map(async (chain) => {
                    try {
                        const res = await getApiByEvmChainIdStatsCumulativeTxs({
                            path: { evmChainId: String(chain.evmChainId) },
                            query: { timestamp }
                        })
                        return {
                            ...chain,
                            cumulativeTxs: res.data?.cumulativeTxs || 0,
                            timestamp: res.data?.timestamp || timestamp,
                            loading: false
                        }
                    } catch (error) {
                        return {
                            ...chain,
                            loading: false,
                            error: error instanceof Error ? error.message : 'Failed to fetch data'
                        }
                    }
                })
            )

            const chainsWithResults = results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value
                } else {
                    return {
                        ...chains[index],
                        loading: false,
                        error: 'Failed to fetch cumulative transactions'
                    }
                }
            })

            chainsWithResults.sort((a, b) => {
                const aTxs = 'cumulativeTxs' in a ? (a.cumulativeTxs || 0) : 0
                const bTxs = 'cumulativeTxs' in b ? (b.cumulativeTxs || 0) : 0
                return bTxs - aTxs
            })
            setChainsWithTxs(chainsWithResults)
        }

        fetchCumulativeTxs()
    }, [chains, timestamp])

    if (chainsIsError) {
        return <ErrorComponent message={chainsError?.message || 'Failed to load chain data'} />
    }

    if (chains.length === 0) {
        return <div className="text-center py-8">Loading chains...</div>
    }

    const firstChain = chainsWithTxs[0]

    return (
        <ExampleCard
            name="Cumulative Transactions by Chain"
            curlString={firstChain ? `curl -X GET "${window.location.origin}/api/${firstChain.evmChainId}/stats/cumulative-txs?timestamp=${timestamp}"` : ''}
        >
            <div className="space-y-3">
                {chainsWithTxs.map((chain, index) => (
                    <div
                        key={chain.evmChainId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-gray-500">#{index + 1}</span>
                            <div>
                                <div className="font-semibold">{chain.chainName}</div>
                                <div className="text-sm text-gray-600">Chain ID: {chain.evmChainId}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            {chain.loading ? (
                                <div className="text-sm text-gray-500">Loading...</div>
                            ) : chain.error ? (
                                <div className="text-sm text-red-500">Error</div>
                            ) : (
                                <div className="font-mono text-lg font-semibold text-blue-600">
                                    {(chain.cumulativeTxs || 0).toLocaleString()}
                                </div>
                            )}
                            <div className="text-xs text-gray-500">cumulative txs</div>
                        </div>
                    </div>
                ))}
            </div>
        </ExampleCard>
    )
}

export default function CumulativeTxs() {
    const [timestamp, setTimestamp] = useState<number>(Math.floor(Date.now() / 1000))

    const handleTimestampChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value)
        if (!isNaN(value)) {
            setTimestamp(value)
        }
    }

    const formatTimestampForInput = (ts: number): string => {
        return new Date(ts * 1000).toISOString().slice(0, 16)
    }

    const handleDateTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const dateTime = new Date(event.target.value)
        setTimestamp(Math.floor(dateTime.getTime() / 1000))
    }

    return (
        <div className="py-8 px-4 md:px-8">
            <div className="flex flex-col gap-4 mb-8">
                <h1 className="text-3xl font-bold">📊 Cumulative Transactions</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3 text-base">Cumulative Transaction Counts</div>
                    <p className="text-sm mb-3">
                        View the total number of transactions processed by each chain at a specific timestamp:
                    </p>
                    <ul className="space-y-1 mb-4">
                        <li><span className="font-semibold">Timestamp:</span> Unix timestamp to query (defaults to current time)</li>
                        <li><span className="font-semibold">Cumulative Count:</span> Total transactions processed up to that timestamp</li>
                        <li><span className="font-semibold">Ranking:</span> Chains sorted by transaction count (highest first)</li>
                    </ul>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Date & Time
                            </label>
                            <input
                                type="datetime-local"
                                value={formatTimestampForInput(timestamp)}
                                onChange={handleDateTimeChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Unix Timestamp
                            </label>
                            <input
                                type="number"
                                value={timestamp}
                                onChange={handleTimestampChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Unix timestamp"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1">
                <CumulativeTxsList timestamp={timestamp} />
            </div>
        </div>
    )
}
