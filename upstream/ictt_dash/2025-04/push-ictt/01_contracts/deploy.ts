const endpoint = process.argv[2]

if (!endpoint) {
    console.error("Endpoint is required")
    process.exit(1)
}

// eth address: 0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC
const hardHatKeyStr = "56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027"

import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const walletClient = createWalletClient({
    account: privateKeyToAccount(`0x${hardHatKeyStr}`),
    transport: http(endpoint),
})
const publicClient = createPublicClient({
    transport: http(endpoint),
})

const chainID = await publicClient.getChainId()
const chain: Chain = {
    id: chainID,
    name: "ICM",
    rpcUrls: {
        default: {
            http: [endpoint],
            webSocket: [endpoint.replace("http", "ws")]
        }
    },
    nativeCurrency: {
        name: "TEST",
        symbol: "TEST",
        decimals: 18
    }
}

import ICMSender from "./compiled/ICMSender.json"
const hash = await walletClient.deployContract({
    abi: ICMSender.abi,
    account: walletClient.account,
    bytecode: ICMSender.bytecode.object as `0x${string}`,
    chain,
})

const tx1 = await publicClient.waitForTransactionReceipt({ hash })
console.log(`Sender: ${tx1.contractAddress}`)

import ICMReceiver from "./compiled/ICMReceiver.json"
const hash2 = await walletClient.deployContract({
    abi: ICMReceiver.abi,
    account: walletClient.account,
    bytecode: ICMReceiver.bytecode.object as `0x${string}`,
    chain,
})

const tx2 = await publicClient.waitForTransactionReceipt({ hash: hash2 })
console.log(`Receiver: ${tx2.contractAddress}`)

process.exit(0)
