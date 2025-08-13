import db from "./db";
import pLimit from "p-limit"

type Tx = {
    unsignedTx: Record<string, any>
    id: string
    tx: any[]
}

async function getHeight(): Promise<{ result: { height: string } }> {
    const response = await fetch('http://127.0.0.1:9654/ext/bc/P', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.getHeight',
            params: {},
            id: 1
        })
    });
    return response.json() as Promise<{ result: { height: string } }>;
}

async function getBlockByHeight(blockHeight: number): Promise<{ result: { block: { txs: Tx[], time: number, id: string } } }> {
    const response = await fetch('http://127.0.0.1:9654/ext/bc/P', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.getBlockByHeight',
            params: {
                height: blockHeight,
                encoding: 'json'
            },
            id: 1
        })
    });

    return response.json() as Promise<{ result: { block: { txs: Tx[], time: number, id: string } } }>;
}

type ValidatorsResponse = {
    result: Record<string, {
        publicKey: string | null,
        weight: string
    }>
}

async function getValidatorsAt(height: number | "proposed", subnetID?: string): Promise<ValidatorsResponse> {
    const params: { height: number | "proposed", subnetID?: string } = { height };
    if (subnetID) {
        params.subnetID = subnetID;
    }

    const response = await fetch('http://127.0.0.1:9654/ext/bc/P', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.getValidatorsAt',
            params: params,
            id: 1
        })
    });

    return response.json() as Promise<ValidatorsResponse>;
}

const { result: { height: lastBlockStr } } = await getHeight();
const lastBlock = parseInt(lastBlockStr, 10);

async function isSubnetValidated(subnetId: string): Promise<boolean> {
    const validators = (await getValidatorsAt("proposed", subnetId)).result
    const ZERO_ID = "NodeID-111111111111111111116DBWJs"
    delete validators[ZERO_ID]
    return Object.keys(validators).length > 0
}

async function extractSubnetIdsCreatedInABlock(blockHeight: number): Promise<string[]> {
    const block = await getBlockByHeight(blockHeight);
    if ((block.result.block.id) && !block.result.block.txs) {
        return []//normal, just no txs
    }
    return block.result.block.txs.filter(looksLikeCreateSubnetTx).map(tx => tx.id)
}

function looksLikeCreateSubnetTx(tx: Tx): boolean {
    const fields = Object.keys(tx.unsignedTx);
    const allowedFields = ['networkID', 'blockchainID', 'outputs', 'inputs', "memo", "owner"];

    let extraFields = []
    for (const field of fields) {
        if (!allowedFields.includes(field)) {
            extraFields.push(field);
        }
    }

    if (extraFields.length > 0) {
        return false;
    }

    return true;
}

const lastProcessedBlock = db.getLastprocessedBlock();

for (let i = lastProcessedBlock; i <= lastBlock; i++) {
    if (i % 1000 === 0) {
        console.log(`Processing block ${i}`)
    }
    const subnetIds = await extractSubnetIdsCreatedInABlock(i)
    db.addSubnets(subnetIds)
    db.setLastprocessedBlock(i)
}

console.log(`Processed ${await db.getLastprocessedBlock()} blocks and ${await db.getAllSubnets().length} subnets`)

const limit = pLimit(200)

const start = Date.now()

// Create an array of promises, each wrapped by the limiter
const validationPromises = (await db.getAllSubnets()).map(subnetId => {
    return limit(async () => {
        if (await isSubnetValidated(subnetId)) {
            return subnetId // Return the subnetId if validated
        }
        return null // Return null otherwise
    })
});

// Wait for all promises to settle
const results = await Promise.all(validationPromises);

// Filter out the nulls and create the Set
const validatedSubnets = new Set<string>(results.filter((id): id is string => id !== null));

db.updateValidatedSubnets(Array.from(validatedSubnets))
console.log(`Found ${validatedSubnets.size} validated subnets in ${Date.now() - start}ms`)
