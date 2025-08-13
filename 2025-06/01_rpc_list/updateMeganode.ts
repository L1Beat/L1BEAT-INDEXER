import chains from './data/chains.json' assert { type: 'json' };
import trackExtraChains from './data/trackExtraChains.json' assert { type: 'json' };
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { generateCompose } from './lib/generateCompose';
import { config } from 'dotenv';
config()

const subnetsToBlockchainId: Record<string, string[]> = {};
for (const chain of chains) {
    if (!subnetsToBlockchainId[chain.subnetId]) {
        subnetsToBlockchainId[chain.subnetId] = [];
    }
    if (chain.blockchainId) {
        subnetsToBlockchainId[chain.subnetId].push(chain.blockchainId);
    }
}

// Get chains without RPC URLs
const chainsWithoutRpc = chains.filter(chain => !chain.rpcUrl);

// Get blockchainIds from trackExtraChains
const extraBlockchainIds = trackExtraChains as string[];

// Find subnets for chains without RPC or in trackExtraChains
const subnetsToTrackSet = new Set<string>();
for (const chain of chainsWithoutRpc) {
    if (chain.subnetId) {
        subnetsToTrackSet.add(chain.subnetId);
    }
}

// Add subnets for chains in trackExtraChains
for (const chain of chains) {
    if (chain.blockchainId && extraBlockchainIds.includes(chain.blockchainId)) {
        if (chain.subnetId) {
            subnetsToTrackSet.add(chain.subnetId);
        }
    }
}

// Convert to array and filter out primary subnet
const PRIMARY_SUBNET_ID = "11111111111111111111111111111111LpoYY"
const subnetsToTrack = [...subnetsToTrackSet].filter(subnet => subnet !== PRIMARY_SUBNET_ID)

// Load existing tracked subnets if file exists
let trackedSubnets: string[] = []
const trackedSubnetsPath = './data/trackedSubnets.json'
if (existsSync(trackedSubnetsPath)) {
    trackedSubnets = JSON.parse(readFileSync(trackedSubnetsPath, 'utf-8'))
}

// Find new subnets that need to be tracked
const newSubnets = subnetsToTrack.filter(subnet => !trackedSubnets.includes(subnet));

console.log(`Tracking ${chainsWithoutRpc.length} chains without RPC`);
console.log(`Tracking ${extraBlockchainIds.length} chains from trackExtraChains`);
console.log(`Total subnets to track: ${subnetsToTrack.length}`);
console.log(`Currently tracking ${trackedSubnets.length} subnets`);
console.log(`Found ${newSubnets.length} new subnets to add:`, newSubnets);

// Add new subnets to tracked list
if (newSubnets.length > 0) {
    trackedSubnets.push(...newSubnets);
    console.log(`\nAdded ${newSubnets.length} new subnets`);
}

// Sort for consistent ordering
trackedSubnets.sort();

// Write the updated tracked subnets back to file
writeFileSync(trackedSubnetsPath, JSON.stringify(trackedSubnets, null, 4));

// Summary
console.log(`\nTotal subnets being tracked: ${trackedSubnets.length}`);

// Add first subnet if no subnets are being tracked
if (trackedSubnets.length === 0 && subnetsToTrack.length > 0) {
    console.log('\nNo subnets currently tracked. Adding first subnet...');
    trackedSubnets = [subnetsToTrack[0]];
    writeFileSync(trackedSubnetsPath, JSON.stringify(trackedSubnets, null, 4));
    console.log(`Added first subnet: ${subnetsToTrack[0]}`);
}

const MEGANODE_DOMAIN = process.env.MEGANODE_DOMAIN
if (!MEGANODE_DOMAIN) throw new Error("MEGANODE_DOMAIN is not set. Put it into .env")

const compose = generateCompose(trackedSubnets, subnetsToBlockchainId, MEGANODE_DOMAIN)
writeFileSync('./data/meganode-compose.yml', compose,)
