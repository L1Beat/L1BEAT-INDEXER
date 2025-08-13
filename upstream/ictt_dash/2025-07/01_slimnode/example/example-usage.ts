import { ApiClient } from './api-client.js';

const SUBNET_ID = "2pbfovVMagvDd6acVEHV7YXKLx1TsacRMhkx9X4kXmRJXJR3mf";
const CHAIN_ID = "PeHXhW11L5sNVeAyWuP2q2F6TBFwBs2f2LJNWv849uHc6FXD5";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD environment variable is not set');

// Create client
const client = new ApiClient('http://localhost:3000', ADMIN_PASSWORD);

console.log('=== SlimNode Example Usage ===\n');
console.log(`Subnet ID: ${SUBNET_ID}`);
console.log(`Chain ID: ${CHAIN_ID}\n`);

// Step 1: Check initial status
console.log('1. Checking initial subnet status...');
const initialStatus = await client.getSubnetStatus(SUBNET_ID);

console.log(`   Current nodes: ${initialStatus.nodes?.length || 0}`);
if (initialStatus.nodes && initialStatus.nodes.length > 0) {
    initialStatus.nodes.forEach(node => {
        console.log(`   - Node ${node.nodeIndex}: ${node.nodeInfo?.result?.nodeID}`);
    });

    // Step 2: Remove all existing nodes
    console.log('\n2. Removing all existing nodes...');
    for (const node of initialStatus.nodes) {
        if (node.nodeIndex !== undefined) {
            await client.removeNodeFromSubnet(SUBNET_ID, node.nodeIndex);
            console.log(`   ✓ Removed node ${node.nodeIndex}`);
        }
    }
} else {
    console.log('   No nodes currently assigned to subnet');
}

// Step 3: Add one node
console.log('\n3. Adding one node to subnet...');
const addResponse = await client.addNodeToSubnet(SUBNET_ID);

const addedNode = addResponse.nodes?.[0];
console.log(`   ✓ Added node ${addedNode?.nodeIndex} to subnet`);
console.log(`   Node ID: ${addedNode?.nodeInfo?.result?.nodeID}`);

// Step 4: Verify final status
console.log('\n4. Final subnet status:');
const finalStatus = await client.getSubnetStatus(SUBNET_ID);

console.log(`   Total nodes: ${finalStatus.nodes?.length || 0}`);
finalStatus.nodes?.forEach(node => {
    console.log(`   - Node ${node.nodeIndex}: ${node.nodeInfo?.result?.nodeID}`);
});

// Step 5: Print RPC URL
console.log('\n5. RPC Endpoint Information:');
const rpcUrl = client.getRpcUrl(CHAIN_ID);
console.log(`   RPC URL: ${rpcUrl}`);
console.log(`   You can now make JSON-RPC requests to this endpoint`);
console.log(`   Example: curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' ${rpcUrl}`);

console.log('\n=== Example completed ===');
