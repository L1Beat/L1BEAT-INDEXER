#!/usr/bin/env bun

import YAML from 'yaml'
import fs from 'fs'
import { createPublicClient, http } from 'viem'
import { fetchSubnet } from './rpc'

// Parse compose.yml to extract subnet-to-port mapping
function parseComposeFile(yamlString: string): Map<string, number> {
    const compose = YAML.parse(yamlString)

    const subnetToPort = new Map<string, number>()

    for (const [serviceName, service] of Object.entries(compose.services)) {
        const environment = (service as any).environment as string[]

        let httpPort: number | undefined
        let trackSubnets: string[] = []

        for (const envVar of environment) {
            if (envVar.startsWith('AVAGO_HTTP_PORT=')) {
                httpPort = parseInt(envVar.split('=')[1]!)
            } else if (envVar.startsWith('AVAGO_TRACK_SUBNETS=')) {
                trackSubnets = envVar.split('=')[1]!.split(',')
            }
        }

        if (httpPort && trackSubnets.length > 0) {
            for (const subnetId of trackSubnets) {
                subnetToPort.set(subnetId.trim(), httpPort)
            }
        }
    }

    return subnetToPort
}

// TODO: Need function to get chain IDs for a subnet
// How do you get the chain IDs for each subnet?
async function getChainIdsForSubnet(subnetId: string): Promise<string[]> {
    const subnet = await fetchSubnet(subnetId)
    return subnet.blockchains.map(blockchain => blockchain.blockchainId)
}

export async function getAliveRpcUrls(yamlString: string): Promise<string[]> {
    let successfulUrls: Set<string> = new Set()

    const stringifyError = (error: any) => {
        const message = typeof error === 'string' ? error : error.message
        return message.slice(0, 100).replace(/\n/g, ' ')
    }

    async function checkChain(chainId: string, port: number) {
        const url = `http://65.21.140.118:${port}/ext/bc/${chainId}/rpc`

        const client = createPublicClient({
            transport: http(url)
        })

        try {
            const block = await client.getBlockNumber()
            console.log(`✅ ${url} block: ${Number(block).toLocaleString()}`)
            successfulUrls.add(url)
        } catch (error) {
            console.log(`❌ ${url} not ready: ${stringifyError(error)}`)
        }
    }


    async function checkSubnet(subnetId: string, port: number) {
        try {
            const chainIds = await getChainIdsForSubnet(subnetId)

            await Promise.all(
                chainIds.map(chainId => checkChain(chainId, port))
            )
        } catch (error) {
            // Silent fail for subnet fetch errors
        }
    }

    const subnetToPort = parseComposeFile(yamlString)
    await Promise.all(
        Array.from(subnetToPort.entries()).map(([subnetId, port]) =>
            checkSubnet(subnetId, port)
        )
    )

    return Array.from(successfulUrls)
}

