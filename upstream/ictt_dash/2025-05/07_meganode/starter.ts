#!/usr/bin/env bun

import { fetchSubnet } from './rpc.js'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import pThrottle from 'p-throttle';

const throttle = pThrottle({
    limit: 10,
    interval: 1000
});

//fetch subnet ids
const subnetIds = process.env.AVAGO_TRACK_SUBNETS?.split(',') || []
const subnetInfos = await Promise.all(subnetIds.map(subnetId => fetchSubnet(subnetId)))

const vmIds = new Set<string>()
const chainIds = new Set<string>()

for (const subnetInfo of subnetInfos) {
    for (const blockchain of subnetInfo.blockchains) {
        vmIds.add(blockchain.vmId)
        chainIds.add(blockchain.blockchainId)
    }
}


const sourcePlugin = 'srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy'
const pluginsDir = '/avalanchego/build/plugins'

// Copy plugin for each VM ID
for (const vmId of vmIds) {
    const targetPath = `${pluginsDir}/${vmId}`
    if (existsSync(targetPath)) {
        console.log(`Plugin already exists for VM ID ${vmId}`)
        continue
    }

    const sourcePath = `${pluginsDir}/${sourcePlugin}`
    execSync(`cp ${sourcePath} ${targetPath}`)
    console.log(`Copied plugin to ${targetPath}`)
}

console.log('Creating chain configs')

const configBaseDir = join(homedir(), '.avalanchego', 'configs', 'chains')
const chainConfig = {
    "pruning-enabled": false,
    "log-level": "debug",
    "warp-api-enabled": true,
    "eth-apis": [
        "eth",
        "eth-filter",
        "net",
        "admin",
        "web3",
        "internal-eth",
        "internal-blockchain",
        "internal-transaction",
        "internal-debug",
        "internal-account",
        "internal-personal",
        "debug",
        "debug-tracer",
        "debug-file-tracer",
        "debug-handler"
    ]
}

const cChainConfig = {
    "state-sync-enabled": false,
    "pruning-enabled": false
}

for (const chainId of [...chainIds, 'C']) {
    const chainConfigDir = join(configBaseDir, chainId)
    const configPath = join(chainConfigDir, 'config.json')
    const config = chainId === 'C' ? cChainConfig : chainConfig

    mkdirSync(chainConfigDir, { recursive: true })
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log(`Created config for chain ${chainId}`)
}

const envContent = `
AVAGO_TRACK_SUBNETS=${Array.from(subnetIds).join(',')}
`;

writeFileSync('/app/.env', envContent);
