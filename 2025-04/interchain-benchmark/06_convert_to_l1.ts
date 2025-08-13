#!/usr/bin/env bun

import { pvmSerial } from '@avalabs/avalanchejs';
import { pvm, utils, L1Validator, Context, PChainOwner } from '@avalabs/avalanchejs';
import { addSigToAllCreds, getNodeIps, getPChainAddress, loadPrivateKey } from './lib';
import fs from 'fs'
import { RPC_ENDPOINT } from './lib';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const VALIDATOR_WEIGHT = 100n;
const VALIDATOR_BALANCE = 100000000n; //0.1 P-Chain avax

const chains = JSON.parse(fs.readFileSync('chains.json', 'utf8')) as Record<string, { subnetId: string, chainId: string }>

const privateKey = loadPrivateKey()
const pChainAddress = getPChainAddress(privateKey)

const popByCluster = await collectPops()
const pChainAddressBytes = utils.bech32ToBytes(pChainAddress)

for (let cluster in popByCluster) {
    const pops = popByCluster[cluster]
    if (!pops) throw new Error(`No pops found for cluster ${cluster}`)
    const chain = chains[cluster]
    if (!chain) throw new Error(`Chain not found for cluster ${cluster}`)
    const txId = await convertToL1(pops, chain.subnetId, chain.chainId)
    console.log(`Converted ${cluster} to L1: ${txId}`)
    await new Promise(resolve => setTimeout(resolve, 5000))
}


async function convertToL1(pops: NodePoP[], subnetId: string, chainId: string): Promise<string> {
    const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
    const feeState = await pvmApi.getFeeState()
    const context = await Context.getContextFromURI(RPC_ENDPOINT);


    const pChainOwner = PChainOwner.fromNative([pChainAddressBytes], 1);


    const validators: L1Validator[] = pops.map(pop => L1Validator.fromNative(
        pop.result.nodeID,
        VALIDATOR_WEIGHT,
        VALIDATOR_BALANCE,
        new pvmSerial.ProofOfPossession(utils.hexToBuffer(pop.result.nodePOP.publicKey), utils.hexToBuffer(pop.result.nodePOP.proofOfPossession)),
        pChainOwner,
        pChainOwner
    ));

    const tx = pvm.e.newConvertSubnetToL1Tx(
        {
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            subnetId,
            utxos,
            chainId,
            validators,
            subnetAuth: [0],
            address: new Uint8Array(32),
        },
        context,
    );

    await addSigToAllCreds(tx, privateKey);
    const signedTx = tx.getSignedTx()

    return pvmApi.issueSignedTx(signedTx).then(tx => tx.txID)
}

// Collect complete JSON response from a single node
async function getNodeResponse(ip: string): Promise<any | null> {
    try {
        console.log(`Fetching info from ${ip}...`);
        const sshKeyPath = "./id_ed25519";

        const { stdout } = await execAsync(
            `ssh -F /dev/null -o IdentitiesOnly=yes -i ${sshKeyPath} -o StrictHostKeyChecking=no ubuntu@${ip} "curl -s -X POST --data '{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"id\\\":1,\\\"method\\\":\\\"info.getNodeID\\\"}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/info"`
        );

        const response = JSON.parse(stdout);
        console.log(`Got response from ${ip}`);
        return response;
    } catch (error) {
        console.error(`Error connecting to ${ip}:`, error);
        return null;
    }
}


type NodePoP = {
    result: {
        nodeID: string;
        nodePOP: {
            publicKey: string;
            proofOfPossession: string;
        };
    }
}

async function collectPops(): Promise<Record<string, NodePoP[]>> {
    const clusters = getNodeIps();
    console.log("Found clusters:", Object.keys(clusters));

    // Object to store results
    const pops: Record<string, any[]> = {};
    let totalNodeCount = 0;
    let skipCount = 0;

    // Process all clusters in parallel
    const clusterPromises = Object.entries(clusters).map(async ([clusterName, ips]) => {
        console.log(`Processing cluster ${clusterName} with ${ips.length} nodes...`);

        // Skip the first machine (benchmarking machine)
        const validNodes = ips.slice(1);

        // Update counters (using atomic operations to avoid race conditions)
        skipCount += ips.length - validNodes.length;
        totalNodeCount += validNodes.length;

        console.log(`Skipping benchmarking node, processing ${validNodes.length} validator nodes`);

        // Process nodes in parallel
        const responsePromises = validNodes.map(ip => getNodeResponse(ip));
        const results = await Promise.all(responsePromises);

        // Filter out null responses
        const responses = results.filter(response => response !== null);
        return { clusterName, responses };
    });

    // Wait for all clusters to be processed
    const clusterResults = await Promise.all(clusterPromises);

    // Populate the pops object with results
    for (const { clusterName, responses } of clusterResults) {
        pops[clusterName] = responses;
    }

    console.log(`Processed ${totalNodeCount} nodes total, skipped ${skipCount} benchmarking nodes`);
    return pops;
}
