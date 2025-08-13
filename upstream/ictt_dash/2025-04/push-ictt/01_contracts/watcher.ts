const endpoint = process.argv[2]

if (!endpoint) {
    console.error("Endpoint is required")
    process.exit(1)
}

import { createPublicClient, createWalletClient, http, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const publicClient = createPublicClient({
    transport: http(endpoint),
})

import ICMReceiver from "./compiled/ICMReceiver.json"

const receiverAddress = process.argv[3]

if (!receiverAddress) {
    console.error("Receiver address is required")
    process.exit(1)
}

let lastCount = 0
let lastMeasurmentTs = 0

for (let i = 0; i < 100; i++) {
    try {
        const count = await publicClient.readContract({
            address: receiverAddress as `0x${string}`,
            abi: ICMReceiver.abi,
            functionName: 'receivedMessageCount',
        }) as bigint

        if (lastCount !== 0) {
            const delta = Number(count) - Number(lastCount)
            const deltaTs = Date.now() - lastMeasurmentTs
            const speed = delta / deltaTs
            console.log(`Speed: ${(speed * 1000).toFixed(2)} messages per second`)
        }
        lastCount = Number(count)
        lastMeasurmentTs = Date.now()
    } catch (error) {
        console.error('Error getting received message count:', error)
    }
    await new Promise(resolve => setTimeout(resolve, 3 * 1000))
}


