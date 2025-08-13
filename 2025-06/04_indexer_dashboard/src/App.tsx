import { useState, useEffect } from 'react'
import IndexerStatusWidget from './components/IndexerStatusWidget'

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

interface IndexerStatus {
  latestBlockNumber: number
  lastUpdatedTimestamp: number
  healthy: boolean
  lastProcessedBlock: number
  totalTxCount: number
}

interface ChainWithStatus extends Chain {
  status?: IndexerStatus
  statusError?: string
}

function App() {
  const [chains, setChains] = useState<ChainWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchChainsAndStatuses = async () => {
      try {
        // Fetch chains data
        const response = await fetch('https://raw.githubusercontent.com/containerman17/experiments/main/2025-06/01_rpc_list/data/chains.json')
        if (!response.ok) {
          throw new Error(`Failed to fetch chains: ${response.status}`)
        }
        const chainsData: Chain[] = await response.json()

        // Fetch statuses for all chains in parallel
        const statusPromises = chainsData.map(async (chain) => {
          try {
            const statusResponse = await fetch(`https://${chain.blockchainId}.idx2.solokhin.com/api/status`)
            if (!statusResponse.ok) {
              throw new Error(`HTTP error! status: ${statusResponse.status}`)
            }
            const statusData = await statusResponse.json()
            return { ...chain, status: statusData }
          } catch (err) {
            return {
              ...chain,
              statusError: err instanceof Error ? err.message : 'Failed to fetch status'
            }
          }
        })

        const chainsWithStatuses = await Promise.all(statusPromises)
        setChains(chainsWithStatuses)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chains')
      } finally {
        setLoading(false)
      }
    }

    fetchChainsAndStatuses()
  }, [])

  // Categorize chains
  const categorizeChains = (chains: ChainWithStatus[]) => {
    const errorChains: ChainWithStatus[] = []
    const inProgressChains: ChainWithStatus[] = []
    const syncedChains: ChainWithStatus[] = []

    chains.forEach(chain => {
      if (chain.statusError) {
        errorChains.push(chain)
      } else if (chain.status) {
        const { latestBlockNumber, lastProcessedBlock } = chain.status

        // Handle genesis-only chains (both blocks are 0)
        if (latestBlockNumber === 0 && lastProcessedBlock === 0) {
          syncedChains.push(chain)
        } else if (latestBlockNumber > 0) {
          const indexedPercentage = (lastProcessedBlock / latestBlockNumber * 100)

          if (indexedPercentage >= 99) {
            syncedChains.push(chain)
          } else {
            inProgressChains.push(chain)
          }
        } else {
          // latestBlockNumber is 0 but lastProcessedBlock > 0 - unusual case
          errorChains.push(chain)
        }
      } else {
        errorChains.push(chain)
      }
    })

    return { errorChains, inProgressChains, syncedChains }
  }

  const { errorChains, inProgressChains, syncedChains } = categorizeChains(chains)

  const renderChainGrid = (chains: ChainWithStatus[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {chains.map((chain) => (
        <IndexerStatusWidget
          key={chain.blockchainId}
          chainName={chain.chainName}
          blockchainId={chain.blockchainId}
          rpcUrl={chain.rpcUrl}
          status={chain.status}
          statusError={chain.statusError}
        />
      ))}
    </div>
  )

  return (
    <>

      {loading && (
        <div className="text-center mt-8">
          <div className="text-gray-600">Loading chains...</div>
        </div>
      )}

      {error && (
        <div className="text-center mt-8">
          <div className="text-red-600">Error: {error}</div>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-8 px-4 space-y-8">
          <div className="text-center text-gray-600">
            {chains.length} total indexers
          </div>

          {/* Synced Section */}
          {syncedChains.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-green-700 mb-4">
                Synced ({syncedChains.length})
              </h2>
              {renderChainGrid(syncedChains)}
            </div>
          )}

          {/* In Progress Section */}
          {inProgressChains.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-yellow-700 mb-4">
                In Progress ({inProgressChains.length})
              </h2>
              {renderChainGrid(inProgressChains)}
            </div>
          )}

          {/* Error Section */}
          {errorChains.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-red-700 mb-4">
                Error ({errorChains.length})
              </h2>
              {renderChainGrid(errorChains)}
            </div>
          )}
        </div>
      )}

    </>
  )
}

export default App
