import YAML from 'yaml'
import fs from 'fs'

// Interface for service configuration
interface ServiceConfig {
    serviceName: string
    containerName: string
    folderSuffix: string
    httpPort: number
    stakingPort: number
    subnetIds: string[],
    skipCChain: boolean
}

// Function to pad numbers with leading zeros
function padzero(num: number, size: number): string {
    return num.toString().padStart(size, '0')
}

// Function to generate a service configuration
function generateService(config: ServiceConfig) {
    return {
        image: 'containerman17/subnet-evm-plus:latest',
        container_name: config.containerName,
        network_mode: 'host',
        restart: 'always',
        volumes: [
            `~/.avalanchego_${config.folderSuffix}/:/root/.avalanchego`
        ],
        environment: [
            `AVAGO_PARTIAL_SYNC_PRIMARY_NETWORK=${config.skipCChain ? 'true' : 'false'}`,
            'AVAGO_PUBLIC_IP_RESOLUTION_SERVICE=opendns',
            'AVAGO_HTTP_HOST=0.0.0.0',
            `AVAGO_HTTP_PORT=${config.httpPort}`,
            `AVAGO_STAKING_PORT=${config.stakingPort}`,
            `AVAGO_TRACK_SUBNETS=${config.subnetIds.join(',')}`,
        ],
        logging: {
            driver: 'json-file',
            options: {
                'max-size': '50m',
                'max-file': '3'
            }
        }
    }
}

// Create an object similar to compose.yml using the function
const composeObject: {
    services: { [key: string]: any }
} = {
    services: {
    }
}

import { subnetIds } from './config'
import pThrottle from 'p-throttle'
import { getAliveRpcUrls } from './check'
import { getGlacierRpcUrls } from './glacier'

// Function to chunk array into groups of specified size
function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

const throttle = pThrottle({
    limit: 10,
    interval: 1000
});

let nextHttpPort = 9000

// Split subnetIds into groups of 16
const subnetGroups = chunk(subnetIds, 16)

for (let i = 0; i < subnetGroups.length; i++) {
    const group = subnetGroups[i] as string[]
    console.log(`Processing group ${i} with ${group.length} subnets`)

    nextHttpPort += 2
    const groupName = padzero(i, 2)

    const serviceName = `avago${groupName}`

    composeObject.services[serviceName] = generateService({
        serviceName: serviceName,
        containerName: serviceName,
        folderSuffix: groupName,
        httpPort: nextHttpPort,
        stakingPort: nextHttpPort + 1,
        subnetIds: group,
        skipCChain: i !== 0,
    })
}

const rpcUrls = await getAliveRpcUrls(YAML.stringify(composeObject))

const rpcUrlVars: string[] = [
    'http://65.21.140.118:9002/ext/bc/C/rpc'
]
for (let i = 0; i < rpcUrls.length; i++) {
    rpcUrlVars.push(`RPC_URL_${i}=${rpcUrls[i]}`)
}

const glacierRpcUrls = await getGlacierRpcUrls('mainnet')
for (let i = 0; i < glacierRpcUrls.length; i++) {
    if (glacierRpcUrls[i]) {
        rpcUrlVars.push(`RPC_URL_${i + rpcUrls.length}=${glacierRpcUrls[i]?.rpcUrl}`)
    }
}

composeObject.services['indexer'] = {
    image: 'containerman17/indexer-dev:latest',
    container_name: 'indexer',
    pull_policy: 'always',
    ports: [
        '80:3000'
    ],
    restart: 'always',
    volumes: [
        `./indexer_data:/data`
    ],
    environment: [
        ...rpcUrlVars,
        `DATA_FOLDER=/data`,
    ],
    logging: {
        driver: 'json-file',
        options: {
            'max-size': '50m',
            'max-file': '3'
        }
    }
}

fs.writeFileSync('compose.yml', YAML.stringify(composeObject))
