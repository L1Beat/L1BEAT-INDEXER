// npx tsx src/components/lz_data/generate.ts

import { writeFileSync } from 'fs'
import path from 'path'

type lzDeploymentsFile = {
    [key: string]: {
        "deployments": {
            "eid": string,
            "chainKey": string,
        }[] | undefined
        chainDetails: {
            chainStack: "AVALANCHE_STACK" | string,
            nativeChainId: string | undefined,
        } | undefined
    }
}

const deploymentsUrl = "https://metadata.layerzero-api.com/v1/metadata/deployments"

const deployments = await fetch(deploymentsUrl)
const deploymentsData = await deployments.json() as lzDeploymentsFile

const deploymentsMap: Map<number, {
    name: string,
    isAvalanche: boolean,
}> = new Map()

for (const chain of Object.values(deploymentsData)) {
    for (const deployment of (chain.deployments || [])) {
        let name = chain.chainDetails?.nativeChainId
            ? `${deployment.chainKey} #${chain.chainDetails.nativeChainId}`
            : deployment.chainKey
        deploymentsMap.set(parseInt(deployment.eid), {
            name: name,
            isAvalanche: chain.chainDetails?.chainStack === "AVALANCHE_STACK",
        })
    }
}

//manual overrides
const nonAvalancheIds = [295, 10294, 30295, 40294]
for (const id of nonAvalancheIds) {
    if (deploymentsMap.has(id)) {
        deploymentsMap.get(id)!.isAvalanche = false
    }
}




const __dirname = path.dirname(new URL(import.meta.url).pathname)

writeFileSync(path.join(__dirname, 'layerZeroIds.json'), JSON.stringify(Object.fromEntries(deploymentsMap), null, 2))
