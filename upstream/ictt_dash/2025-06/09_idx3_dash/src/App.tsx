import { useState, useEffect } from 'react'

interface Chain {
  chainName: string
  blockchainId: string
  subnetId: string
  rpcUrl: string
  evmChainId: string
  blocksCount: string
  glacierChainId: string
  comment: string | null
}

interface ChainInfo {
  evmId: number
  chainId: string
  isDebugEnabled: boolean
  totalBlocksInChain: number
  latestStoredBlock: number
}

interface MetricsResponse {
  results: Array<{
    timestamp: number
    value: number
  }>
  nextPageToken: string
}

interface ChainWithInfo extends Chain {
  info?: ChainInfo
  infoError?: string
  totalTxCount?: number
  metricsError?: string
  teleporterTxCount?: number
  teleporterError?: string
}

const calculateIndexedPercentage = (info: ChainInfo): string => {
  if (info.totalBlocksInChain === 0) {
    return '100.00'
  }
  return ((info.latestStoredBlock / info.totalBlocksInChain) * 100).toFixed(2)
}

const calculateEstimatedTotalTxs = (chain: ChainWithInfo): number | null => {
  if (!chain.info || !chain.totalTxCount) return null

  const percentage = parseFloat(calculateIndexedPercentage(chain.info))
  if (percentage === 0) return null

  // If already synced, return actual count
  if (percentage >= 99) return chain.totalTxCount

  // Otherwise, estimate based on current progress
  return Math.round(chain.totalTxCount * 100 / percentage)
}

function App() {
  const [chains, setChains] = useState<ChainWithInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    const fetchChainsAndInfo = async () => {
      try {
        // Fetch chains data
        const response = await fetch('https://raw.githubusercontent.com/containerman17/experiments/main/2025-06/01_rpc_list/data/chains.json')
        if (!response.ok) {
          throw new Error(`Failed to fetch chains: ${response.status}`)
        }
        const chainsData: Chain[] = await response.json()

        // Fetch info and metrics for all chains in parallel
        const chainPromises = chainsData.map(async (chain) => {
          const chainResult: ChainWithInfo = { ...chain }

          // Fetch info
          try {
            const infoResponse = await fetch(`https://idx3.solokhin.com/v1/chains/${chain.evmChainId}/info`)
            if (!infoResponse.ok) {
              throw new Error(`HTTP error! status: ${infoResponse.status}`)
            }
            chainResult.info = await infoResponse.json()
          } catch (err) {
            chainResult.infoError = err instanceof Error ? err.message : 'Failed to fetch info'
          }

          // Fetch metrics
          try {
            const metricsResponse = await fetch(`https://idx3.solokhin.com/v1/chains/${chain.evmChainId}/metrics/cumulativeTxCount?pageSize=1`)
            if (!metricsResponse.ok) {
              throw new Error(`HTTP error! status: ${metricsResponse.status}`)
            }
            const metricsData: MetricsResponse = await metricsResponse.json()
            if (metricsData.results && metricsData.results.length > 0) {
              chainResult.totalTxCount = metricsData.results[0].value
            }
          } catch (err) {
            chainResult.metricsError = err instanceof Error ? err.message : 'Failed to fetch metrics'
          }

          // Fetch teleporter metrics
          try {
            const teleporterResponse = await fetch(`https://idx3.solokhin.com/v1/chains/${chain.evmChainId}/teleporterMetrics/teleporterTotalTxnCount`)
            if (!teleporterResponse.ok) {
              throw new Error(`HTTP error! status: ${teleporterResponse.status}`)
            }
            const teleporterData = await teleporterResponse.json()
            if (teleporterData.result && teleporterData.result.value !== undefined) {
              chainResult.teleporterTxCount = teleporterData.result.value
            }
          } catch (err) {
            chainResult.teleporterError = err instanceof Error ? err.message : 'Failed to fetch teleporter metrics'
          }

          return chainResult
        })

        const chainsWithInfo = await Promise.all(chainPromises)

        // Sort by estimated total tx count descending
        chainsWithInfo.sort((a, b) => {
          const aEstimated = calculateEstimatedTotalTxs(a) ?? 0
          const bEstimated = calculateEstimatedTotalTxs(b) ?? 0
          return bEstimated - aEstimated
        })

        setChains(chainsWithInfo)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chains')
      } finally {
        setLoading(false)
      }
    }

    fetchChainsAndInfo()
  }, [])

  const getFilteredChains = () => {
    switch (activeFilter) {
      case 'indexed':
        return chains.filter(chain =>
          chain.info && parseFloat(calculateIndexedPercentage(chain.info)) >= 99
        )
      case 'in-progress':
        return chains.filter(chain =>
          chain.info && parseFloat(calculateIndexedPercentage(chain.info)) < 99
        )
      case 'errors':
        return chains.filter(chain => chain.infoError || chain.metricsError)
      case 'debug-enabled':
        return chains.filter(chain => chain.info?.isDebugEnabled === true)
      case 'debug-disabled':
        return chains.filter(chain => chain.info?.isDebugEnabled === false)
      default:
        return chains
    }
  }

  const getCounts = () => {
    return {
      indexed: chains.filter(chain =>
        chain.info && parseFloat(calculateIndexedPercentage(chain.info)) >= 99
      ).length,
      inProgress: chains.filter(chain =>
        chain.info && parseFloat(calculateIndexedPercentage(chain.info)) < 99
      ).length,
      errors: chains.filter(chain => chain.infoError || chain.metricsError).length,
      debugEnabled: chains.filter(chain => chain.info?.isDebugEnabled === true).length,
      debugDisabled: chains.filter(chain => chain.info?.isDebugEnabled === false).length,
    }
  }

  const filteredChains = getFilteredChains()
  const counts = loading ? { indexed: 0, inProgress: 0, errors: 0, debugEnabled: 0, debugDisabled: 0 } : getCounts()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading chains...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chain Indexer Status</h1>
        <a
          href="https://github.com/containerman17/experiments/blob/main/2025-06/01_rpc_list/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          📄 All Chains Documentation
        </a>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`text-sm cursor-pointer ${activeFilter === 'all' ? 'font-bold text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          🌐 All ({chains.length})
        </button>
        <button
          onClick={() => setActiveFilter('indexed')}
          className={`text-sm cursor-pointer ${activeFilter === 'indexed' ? 'font-bold text-green-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          ✅ Indexed ({counts.indexed})
        </button>
        <button
          onClick={() => setActiveFilter('in-progress')}
          className={`text-sm cursor-pointer ${activeFilter === 'in-progress' ? 'font-bold text-yellow-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          ⏳ In Progress ({counts.inProgress})
        </button>
        <button
          onClick={() => setActiveFilter('errors')}
          className={`text-sm cursor-pointer ${activeFilter === 'errors' ? 'font-bold text-red-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          ⚠️ Errors ({counts.errors})
        </button>
        <button
          onClick={() => setActiveFilter('debug-enabled')}
          className={`text-sm cursor-pointer ${activeFilter === 'debug-enabled' ? 'font-bold text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          🐛 Debug Enabled ({counts.debugEnabled})
        </button>
        <button
          onClick={() => setActiveFilter('debug-disabled')}
          className={`text-sm cursor-pointer ${activeFilter === 'debug-disabled' ? 'font-bold text-gray-700' : 'text-gray-600 hover:text-gray-800'}`}
        >
          🔸 Debug Disabled ({counts.debugDisabled})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chain Name
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Txs (Est.)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teleporter Txs
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chain ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Blockchain ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RPC URL
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Indexed %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredChains.map((chain) => (
              <tr key={chain.blockchainId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {chain.chainName}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {chain.metricsError ? (
                    <span className="text-gray-400">-</span>
                  ) : (() => {
                    const estimatedTotal = calculateEstimatedTotalTxs(chain)
                    if (estimatedTotal === null) {
                      return <span className="text-gray-400">-</span>
                    }
                    const isEstimate = chain.info && parseFloat(calculateIndexedPercentage(chain.info)) < 99
                    return (
                      <span className={`font-mono ${isEstimate ? 'text-gray-600 italic' : ''}`}>
                        {estimatedTotal.toLocaleString()}
                        {isEstimate && <span className="text-xs ml-1">*</span>}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {chain.teleporterError ? (
                    <span className="text-gray-400">-</span>
                  ) : chain.teleporterTxCount !== undefined ? (
                    <span className="font-mono">{chain.teleporterTxCount.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  <a
                    href={`https://idx3.solokhin.com/v1/chains/${chain.evmChainId}/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {chain.evmChainId || chain.glacierChainId}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  {chain.blockchainId}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-xs">
                  {chain.rpcUrl}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {chain.infoError ? (
                    <span className="text-red-500">Error</span>
                  ) : chain.info ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <span className={`font-medium ${parseFloat(calculateIndexedPercentage(chain.info)) >= 99 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {calculateIndexedPercentage(chain.info)}%
                        </span>
                        <div className="text-xs text-gray-500">
                          {chain.info.latestStoredBlock.toLocaleString()} / {chain.info.totalBlocksInChain.toLocaleString()}
                        </div>
                      </div>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${parseFloat(calculateIndexedPercentage(chain.info)) >= 99 ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                          style={{ width: `${calculateIndexedPercentage(chain.info)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600 text-center">
        <div>Showing {filteredChains.length} of {chains.length} chains</div>
        {filteredChains.some(chain => chain.info && parseFloat(calculateIndexedPercentage(chain.info)) < 99 && chain.totalTxCount) && (
          <div className="text-xs text-gray-500 mt-1">* Estimated based on current sync progress</div>
        )}
      </div>
    </div>
  )
}

export default App
