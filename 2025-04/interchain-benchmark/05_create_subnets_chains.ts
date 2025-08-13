#!/usr/bin/env bun

import { Context, pvm, utils } from "@avalabs/avalanchejs";
import { loadPrivateKey, getPChainAddress, addTxSignatures, getNodeIps, RPC_ENDPOINT, addSigToAllCreds } from "./lib";

const privateKey = loadPrivateKey()
const pChainAddress = getPChainAddress(privateKey)

const clusters = getNodeIps();

const clusterNames = Object.keys(clusters)

const chains: Record<string, { subnetId: string, chainId: string }> = {}

for (const clusterName of clusterNames) {
    const subnetId = await createSubnet()
    console.log(`Created subnet ${subnetId} for cluster ${clusterName}`)
    await new Promise(resolve => setTimeout(resolve, 5 * 1000))
    const chainId = await createChain(subnetId)
    console.log(`Created chain ${chainId} for subnet ${subnetId}`)
    await new Promise(resolve => setTimeout(resolve, 5 * 1000))
    chains[clusterName] = { subnetId, chainId }
}

import fs from 'fs'
fs.writeFileSync('chains.json', JSON.stringify(chains, null, 4))

async function createSubnet() {
    const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
    const feeState = await pvmApi.getFeeState()
    const context = await Context.getContextFromURI(RPC_ENDPOINT);

    const tx = pvm.e.newCreateSubnetTx(
        {
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            utxos,
            subnetOwners: [utils.bech32ToBytes(pChainAddress)],
        },
        context,
    );

    await addTxSignatures({
        unsignedTx: tx,
        privateKeys: [privateKey],
    });

    return pvmApi.issueSignedTx(tx.getSignedTx()).then(tx => tx.txID)
}

async function createChain(subnetId: string) {
    const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
    const feeState = await pvmApi.getFeeState()
    const context = await Context.getContextFromURI(RPC_ENDPOINT);

    const testPAddr = utils.bech32ToBytes(pChainAddress);

    console.log('pChainAddress', pChainAddress)

    console.log('subnetId', subnetId)

    const tx = pvm.newCreateChainTx({
        feeState,
        fromAddressesBytes: [testPAddr],
        utxos,
        chainName: 'TEST',
        subnetAuth: [0],
        subnetId: subnetId,
        vmId: "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy",
        fxIds: [],
        genesisData: JSON.parse(genGenesis()),
    }, context);

    await addSigToAllCreds(tx, privateKey);
    const signedTx = tx.getSignedTx()

    return pvmApi.issueSignedTx(signedTx).then(tx => tx.txID)
}

function genGenesis() {
    const randomChainID = Math.floor(Math.random() * 1000000)
    return JSON.stringify({
        "airdropAmount": null,
        "airdropHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "alloc": {
            "8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC": {
                "balance": "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
            }
        },
        "baseFeePerGas": null,
        "blobGasUsed": null,
        "coinbase": "0x0000000000000000000000000000000000000000",
        "config": {
            "berlinBlock": 0,
            "byzantiumBlock": 0,
            "chainId": randomChainID,
            "constantinopleBlock": 0,
            "eip150Block": 0,
            "eip155Block": 0,
            "eip158Block": 0,
            "feeConfig": {
                "gasLimit": 20000000,
                "minBaseFee": 100,
                "targetGas": 200000000000,
                "baseFeeChangeDenominator": 9223372036854775807,
                "minBlockGasCost": 0,
                "maxBlockGasCost": 10000000,
                "targetBlockRate": 1,
                "blockGasCostStep": 0
            },
            "homesteadBlock": 0,
            "istanbulBlock": 0,
            "londonBlock": 0,
            "muirGlacierBlock": 0,
            "petersburgBlock": 0,
            "warpConfig": {
                "blockTimestamp": 1744787352,
                "quorumNumerator": 67,
                "requirePrimaryNetworkSigners": true
            }
        },
        "difficulty": "0x0",
        "excessBlobGas": null,
        "extraData": "0x",
        "gasLimit": "0x1312D00",
        "gasUsed": "0x0",
        "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "nonce": "0x0",
        "number": "0x0",
        "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "timestamp": "0x67ff5798"
    })
}
