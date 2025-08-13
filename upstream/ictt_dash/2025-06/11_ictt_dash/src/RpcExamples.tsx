import { useState } from "react"
import { getApiChains, postApiByEvmChainIdRpc } from "./client/sdk.gen"
import { type GetApiChainsResponses } from "./client/types.gen"
import { useQuery } from '@tanstack/react-query'
import ExampleCard from "./components/ExampleCard"
import ErrorComponent from "./components/ErrorComponent"
import { encodingUtils } from "frostbyte-sdk"

type Chain = GetApiChainsResponses[200][0]


interface RpcCardProps {
    selectedChainId: number | null
    chains: Chain[]
    onChainSelect: (chainId: number) => void
    defaultChainId?: number
}

function ChainIdCard({ selectedChainId, chains, onChainSelect, defaultChainId }: RpcCardProps) {
    const { data: chainIdData } = useQuery({
        queryKey: ['rpc', 'eth_chainId', selectedChainId],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_chainId', params: [] }
            })
            return res.data
        },
        enabled: !!selectedChainId
    })

    const formatHexNumber = (hex: string | undefined): string => {
        if (!hex) return '0'
        try {
            return parseInt(hex, 16).toLocaleString()
        } catch {
            return hex
        }
    }

    return (
        <ExampleCard
            name="eth_chainId"
            curlString={`curl -X POST "${window.location.origin}/api/${selectedChainId}/rpc" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"eth_chainId","params":[]}'`}
            chains={chains}
            selectedChainId={selectedChainId}
            onChainSelect={onChainSelect}
            defaultChainId={defaultChainId}
        >
            <div className="flex flex-col items-center justify-center py-12">
                <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {chainIdData && 'result' in chainIdData
                        ? formatHexNumber(chainIdData.result as string)
                        : '...'}
                </div>
                <div className=" mt-2 font-mono text-sm">
                    {chainIdData && 'result' in chainIdData ? chainIdData.result as string : '...'}
                </div>
            </div>
        </ExampleCard>
    )
}

function BlockNumberCard({ selectedChainId, chains, onChainSelect, defaultChainId }: RpcCardProps) {
    const { data: blockNumberData } = useQuery({
        queryKey: ['rpc', 'eth_blockNumber', selectedChainId],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_blockNumber', params: [] }
            })
            return res.data
        },
        enabled: !!selectedChainId
    })

    const formatHexNumber = (hex: string | undefined): string => {
        if (!hex) return '0'
        try {
            return parseInt(hex, 16).toLocaleString()
        } catch {
            return hex
        }
    }

    return (
        <ExampleCard
            name="eth_blockNumber"
            curlString={`curl -X POST "${window.location.origin}/api/${selectedChainId}/rpc" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"eth_blockNumber","params":[]}'`}
            chains={chains}
            selectedChainId={selectedChainId}
            onChainSelect={onChainSelect}
            defaultChainId={defaultChainId}
        >
            <div className="flex flex-col items-center justify-center py-12">
                <div className="text-sm uppercase tracking-wider  mb-2">Latest Block</div>
                <div className="text-4xl font-bold text-green-600">
                    {blockNumberData && 'result' in blockNumberData
                        ? formatHexNumber(blockNumberData.result as string)
                        : '...'}
                </div>
                <div className=" mt-2 font-mono text-xs">
                    {blockNumberData && 'result' in blockNumberData ? blockNumberData.result as string : '...'}
                </div>
            </div>
        </ExampleCard>
    )
}


function EthCallCard({ selectedChainId, chains, onChainSelect, defaultChainId }: RpcCardProps) {
    const { data: callData } = useQuery({
        queryKey: ['rpc', 'eth_call', selectedChainId],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: {
                    method: 'eth_call',
                    params: [
                        {
                            to: '0x0200000000000000000000000000000000000005',
                            data: '0x4213cf78'
                        },
                        'latest'
                    ]
                }
            })
            if (res.data && 'result' in res.data) {
                return res.data.result as string
            }
            throw new Error('Failed to get call data')
        },
        enabled: !!selectedChainId
    })

    return (
        <ExampleCard
            name="eth_call (Warp Contract)"
            curlString={`curl -X POST "${window.location.origin}/api/${selectedChainId}/rpc" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"eth_call","params":[{"to":"0x0200000000000000000000000000000000000005","data":"0x4213cf78"},"latest"]}'`}
            chains={chains}
            selectedChainId={selectedChainId}
            onChainSelect={onChainSelect}
            defaultChainId={defaultChainId}
        >
            <div className="flex flex-col items-center justify-center py-8">
                <div className="text-sm uppercase tracking-wider  mb-3">Blockchain ID</div>
                <div className="font-mono text-lg text-purple-600 break-all px-4 text-center">
                    {callData
                        ? encodingUtils.hexToCB58(callData)
                        : '...'}
                </div>
                <div className="text-xs  mt-3 font-mono text-center">
                    Hex: {callData}
                </div>
            </div>
        </ExampleCard>
    )
}

function GetBlockCard({ selectedChainId, chains, onChainSelect, defaultChainId }: RpcCardProps) {
    const { data: blockData } = useQuery({
        queryKey: ['rpc', 'eth_getBlockByNumber', selectedChainId],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_getBlockByNumber', params: ['0x1', true] }
            })
            return res.data
        },
        enabled: !!selectedChainId
    })

    return (
        <ExampleCard
            name="eth_getBlockByNumber (Block 1)"
            curlString={`curl -X POST "${window.location.origin}/api/${selectedChainId}/rpc" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"eth_getBlockByNumber","params":["0x1",true]}'`}
            chains={chains}
            selectedChainId={selectedChainId}
            onChainSelect={onChainSelect}
            defaultChainId={defaultChainId}
        >
            <div className="h-64 overflow-auto bg-gray-50 rounded p-3">
                <pre className="text-xs font-mono ">{JSON.stringify(blockData, null, 2)}</pre>
            </div>
        </ExampleCard>
    )
}

function GetTransactionReceiptCard({ selectedChainId, chains, onChainSelect, defaultChainId }: RpcCardProps) {
    const { data: blockNumberData } = useQuery({
        queryKey: ['rpc', 'eth_blockNumber', selectedChainId],
        queryFn: async () => {
            if (!selectedChainId) return null
            const res = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_blockNumber', params: [] }
            })
            return res.data
        },
        enabled: !!selectedChainId
    })

    const { data: txReceiptData } = useQuery({
        queryKey: ['rpc', 'eth_getTransactionReceipt', selectedChainId, blockNumberData],
        queryFn: async () => {
            if (!selectedChainId || !blockNumberData || !('result' in blockNumberData)) return null

            // First get the latest block
            const blockRes = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_getBlockByNumber', params: [blockNumberData.result as string, true] }
            })

            if (!blockRes.data || !('result' in blockRes.data) || !blockRes.data.result) return null
            const block = blockRes.data.result as any

            if (!block.transactions || block.transactions.length === 0) {
                return { error: "No transactions in latest block", txHash: null }
            }

            const firstTxHash = typeof block.transactions[0] === 'string'
                ? block.transactions[0]
                : block.transactions[0].hash

            // Get the transaction receipt
            const receiptRes = await postApiByEvmChainIdRpc({
                path: { evmChainId: selectedChainId },
                body: { method: 'eth_getTransactionReceipt', params: [firstTxHash] }
            })

            return { ...receiptRes.data, txHash: firstTxHash }
        },
        enabled: !!selectedChainId && !!blockNumberData
    })

    const txHash = txReceiptData?.txHash || "<TX_HASH>"

    return (
        <ExampleCard
            name="eth_getTransactionReceipt"
            curlString={`curl -X POST "${window.location.origin}/api/${selectedChainId}/rpc" \\
  -H "Content-Type: application/json" \\
  -d '{"method":"eth_getTransactionReceipt","params":["${txHash}"]}'`}
            chains={chains}
            selectedChainId={selectedChainId}
            onChainSelect={onChainSelect}
            defaultChainId={defaultChainId}
        >
            <div className="h-64 overflow-auto bg-gray-50 rounded p-3">
                {txReceiptData && ('error' in txReceiptData) && typeof txReceiptData.error === 'string' ? (
                    <div className="text-center  py-8">{txReceiptData.error}</div>
                ) : (
                    <pre className="text-xs font-mono ">{JSON.stringify(txReceiptData, null, 2)}</pre>
                )}
            </div>
        </ExampleCard>
    )
}

export default function Rpc() {
    const [selectedChainId, setSelectedChainId] = useState<number | null>(null)

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
                <h1 className="text-3xl font-bold ">🔧 RPC Demo</h1>

                <div className="border border-gray-200 rounded-xl bg-white p-6">
                    <div className="mb-3  text-base">RPC Caching</div>
                    <p className=" text-sm mb-3">
                        These requests are served from the indexer's database cache:
                    </p>
                    <ul className="space-y-1 mb-3">
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">eth_chainId</code></li>
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">eth_blockNumber</code></li>
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">eth_getBlockByNumber</code></li>
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">eth_getTransactionReceipt</code></li>
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">debug_traceBlockByNumber*</code></li>
                        <li><code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">eth_call**</code></li>
                    </ul>
                    <div className=" text-xs mt-2">
                        <div>* if debug enabled</div>
                        <div>** only for Warp contract getBlockchainID calls</div>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <ChainIdCard selectedChainId={selectedChainId} chains={chains} onChainSelect={setSelectedChainId} defaultChainId={43114} />
                <BlockNumberCard selectedChainId={selectedChainId} chains={chains} onChainSelect={setSelectedChainId} defaultChainId={43114} />
                <EthCallCard selectedChainId={selectedChainId} chains={chains} onChainSelect={setSelectedChainId} defaultChainId={43114} />
                <GetBlockCard selectedChainId={selectedChainId} chains={chains} onChainSelect={setSelectedChainId} defaultChainId={43114} />
                <GetTransactionReceiptCard selectedChainId={selectedChainId} chains={chains} onChainSelect={setSelectedChainId} defaultChainId={43114} />
            </div>
        </div>
    )
}
