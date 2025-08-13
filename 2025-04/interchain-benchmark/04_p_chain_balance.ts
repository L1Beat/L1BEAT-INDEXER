#!/usr/bin/env bun

import { formatUnits } from 'viem';
import { loadPrivateKey, getPChainAddress, RPC_ENDPOINT } from './lib';
import { Context, pvm } from '@avalabs/avalanchejs';
const privateKey = loadPrivateKey()
const pChainAddress = getPChainAddress(privateKey)
console.log('Your P-Chain Address:', pChainAddress);

const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
const balance = await pvmApi.getBalance({
    addresses: [pChainAddress],
})

console.log('P Chain Balance:', formatUnits(balance.balance, 9), 'AVAX');
if (balance.balance === BigInt(0)) {
    console.log('Import the private key into Core and transfer some Fuji AVAX to P-Chain Address to continue');
}


