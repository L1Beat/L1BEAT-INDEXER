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
const receiverAddress = "0x17ab05351fc94a1a67bf3f56ddbb941ae6c63e25"
const receiverChainID = "0x297706a9d583e56aaea89f408c006fd1c8807ce9d2387fa0b0cb801af6cf0662"
const senderAddress = "0x789a5fdac2b37fcd290fb2924382297a6ae65860"

// const abi = [
//     {
//         "type": "function",
//         "name": "sendMessage",
//         "inputs": [{
//             "name": "destinationAddress",
//             "type": "address",
//             "internalType": "address"
//         }, {
//             "name": "destinationBlockchainID",
//             "type": "bytes32",
//             "internalType": "bytes32"
//         }],
//         "outputs": [],
//         "stateMutability": "nonpayable"
//     }
// ]

// const txId = await walletClient.writeContract({
//     abi: ICMSender.abi,
//     address: senderAddress,
//     functionName: "sendMessage",
//     args: [receiverAddress, receiverChainID],
//     chain,
// })
const txId = "0x7719a9767b6d584b2ff3b301684d193ae09422b3035817747c46eb3efba5a44c"

// Print the payload data that would be sent
console.log("Transaction data payload:", txId)

// console.log(simRequest)

const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txId })
console.log(txReceipt)

const tx = await publicClient.getTransaction({ hash: txId })
console.log(JSON.stringify(tx, (key, value) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}, 2))

process.exit(0)
