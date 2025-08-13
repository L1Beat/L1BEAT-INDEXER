
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { WagmiProvider, createConfig, useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { avalancheFuji } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type CompatiblePublicClient, type CompatibleWalletClient, useEERC } from '@avalabs/eerc-sdk'
import { http } from 'viem'

declare global {
  interface Window {
    ethereum?: any
  }
}

// Zustand store for wallet state
interface WalletState {
  address: string | null
  setAddress: (address: string | null) => void
}

const useWalletStore = create<WalletState>((set) => ({
  address: null,
  setAddress: (address) => set({ address }),
}))

function App() {
  return (
    <Wallet>
      <EERCWrapper />
    </Wallet>
  )
}

// Wagmi config and QueryClient should be created only once
const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected({
      shimDisconnect: false,
    }),
  ],
  transports: {
    [avalancheFuji.id]: http(),
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5, // 5 seconds
      refetchOnWindowFocus: true,
      refetchInterval: false,
    },
  },
})

// Wagmi wrapper component - only wraps EERC functionality
function EERCWrapper() {
  const { address } = useWalletStore()

  if (!address) {
    return <div className="text-gray-500">Connect wallet to use EERC features</div>
  }

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <EERCInterface />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

const CIRCUIT_CONFIG = {
  register: {
    wasm: "/RegistrationCircuit.wasm",
    zkey: "/RegistrationCircuit.groth16.zkey",
  },
  mint: {
    wasm: "/MintCircuit.wasm",
    zkey: "/MintCircuit.groth16.zkey",
  },
  transfer: {
    wasm: "/TransferCircuit.wasm",
    zkey: "/TransferCircuit.groth16.zkey",
  },
  withdraw: {
    wasm: "/WithdrawCircuit.wasm",
    zkey: "/WithdrawCircuit.groth16.zkey",
  },
  burn: {
    wasm: "/BurnCircuit.wasm",
    zkey: "/BurnCircuit.groth16.zkey",
  },
} as const;

// Contract addresses from the reference
export const CONTRACTS = {
  EERC_STANDALONE: "0x5E9c6F952fB9615583182e70eDDC4e6E4E0aC0e0",
  EERC_CONVERTER: "0x372dAB27c8d223Af11C858ea00037Dc03053B22E",
  ERC20: "0xb0Fe621B4Bd7fe4975f7c58E3D6ADaEb2a2A35CD",
} as const;

// EERC Interface Component
function EERCInterface() {
  const { status } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  if (status !== 'connected' || !publicClient || !walletClient) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">EERC Demo</h1>
        <p className="text-gray-500">Waiting for wallet connection to initialize EERC...</p>
      </div>
    )
  }

  return <EERCActions publicClient={publicClient} walletClient={walletClient} />
}

function EERCActions({
  publicClient,
  walletClient,
}: {
  publicClient: CompatiblePublicClient
  walletClient: CompatibleWalletClient
}) {
  const { address } = useAccount()
  const [txHash, setTxHash] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const {
    isRegistered,
    isDecryptionKeySet,
    generateDecryptionKey,
    register,
  } = useEERC(
    publicClient,
    walletClient,
    CONTRACTS.EERC_CONVERTER,
    CIRCUIT_CONFIG
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">EERC Demo</h1>

      <DecryptionKeySection
        isDecryptionKeySet={isDecryptionKeySet}
        onGenerateKey={async () => {
          try {
            await generateDecryptionKey()
            alert('🔑 Decryption key generated!')
          } catch (error) {
            console.error(error)
            alert(`Error generating key: ${error}`)
          }
        }}
        disabled={!address}
      />

      <RegistrationSection
        isRegistered={isRegistered}
        isRegistering={isRegistering}
        onRegister={async () => {
          setIsRegistering(true)
          try {
            const { transactionHash } = await register()
            setTxHash(transactionHash)
            alert(`Registration successful! TX: ${transactionHash}`)
          } catch (error) {
            console.error(error)
            alert(`Registration failed: ${error}`)
          } finally {
            setIsRegistering(false)
          }
        }}
        disabled={!isDecryptionKeySet}
        txHash={txHash}
      />
    </div>
  )
}

// Decryption Key Component
function DecryptionKeySection({
  isDecryptionKeySet,
  onGenerateKey,
  disabled
}: {
  isDecryptionKeySet: boolean
  onGenerateKey: () => Promise<void>
  disabled: boolean
}) {
  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">🔑 Generate Decryption Key</h2>
      <p className="text-sm text-gray-600 mb-4">
        This key is derived by signing a message with your wallet. It never leaves your device.
      </p>
      <button
        onClick={onGenerateKey}
        disabled={disabled || isDecryptionKeySet}
        className={`px-4 py-2 rounded ${disabled || isDecryptionKeySet
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
      >
        {isDecryptionKeySet ? '✓ Key Generated' : 'Generate Decryption Key'}
      </button>
    </div>
  )
}

// Registration Component
function RegistrationSection({
  isRegistered,
  isRegistering,
  onRegister,
  disabled,
  txHash
}: {
  isRegistered: boolean
  isRegistering: boolean
  onRegister: () => Promise<void>
  disabled: boolean
  txHash: string
}) {
  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">🧾 Registration</h2>
      <p className="text-sm text-gray-600 mb-4">
        Register your wallet to enable encrypted transactions. This is a one-time on-chain process.
      </p>
      <button
        onClick={onRegister}
        disabled={disabled || isRegistered || isRegistering}
        className={`px-4 py-2 rounded ${disabled || isRegistered || isRegistering
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
      >
        {isRegistered ? '✓ Registered' : isRegistering ? 'Registering...' : 'Register Wallet'}
      </button>
      {isRegistering && txHash && (
        <p className="mt-2 text-xs text-gray-600">
          TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </p>
      )}
    </div>
  )
}

// Original Wallet wrapper adapted to work with Wagmi
function Wallet({ children }: { children: React.ReactNode }) {
  const { address, setAddress } = useWalletStore()

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed!')
      return
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        setAddress(accounts[0])
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0])
          }
        })
        .catch(console.error)
    }
  }, [setAddress])

  if (address) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <p className="text-gray-600">Connected: <span className="font-mono text-sm">{address}</span></p>
          <button
            onClick={() => setAddress(null)}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Disconnect
          </button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="p-4">
      <button
        onClick={connectWallet}
        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
      >
        Connect Wallet
      </button>
    </div>
  )
}

export default App
