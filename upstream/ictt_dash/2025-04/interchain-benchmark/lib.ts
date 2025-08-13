import * as fs from 'fs';
import * as path from 'path';

const NODES_PER_CLUSTER = parseInt(process.env.NODES_PER_CLUSTER || "0")
if (isNaN(NODES_PER_CLUSTER) || NODES_PER_CLUSTER < 1) {
    throw new Error("NODES_PER_CLUSTER is not set")
}

export function getNodeIps(): Record<string, string[]> {
    const nodes: Record<string, string[]> = {};
    const stateFilePath = 'terraform.tfstate';

    try {
        if (fs.existsSync(stateFilePath)) {
            const stateFile = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));

            if (stateFile.outputs && stateFile.outputs.public_ips && stateFile.outputs.public_ips.value) {
                // Extract all IPs from the output value
                const allIps = Object.values(stateFile.outputs.public_ips.value) as string[];

                // Group IPs into virtual clusters
                const totalNodesPerCluster = NODES_PER_CLUSTER + 1; // +1 for benchmarking node
                const virtualClusterCount = Math.floor(allIps.length / totalNodesPerCluster);

                for (let i = 0; i < virtualClusterCount; i++) {
                    const startIdx = i * totalNodesPerCluster;
                    const clusterIps = allIps.slice(startIdx, startIdx + totalNodesPerCluster);
                    const clusterName = i < 9 ? `cluster_0${i + 1}` : `cluster_${i + 1}`;
                    nodes[clusterName] = clusterIps;
                }
            }
        }
    } catch (error) {
        console.error(`Error reading state file:`, error);
    }

    return nodes;
}

import { exec } from "child_process";
import { promisify } from "util";
import { Context, pvm, secp256k1, UnsignedTx, utils } from '@avalabs/avalanchejs';

const execAsync = promisify(exec);
export async function applyDockerCompose(ip: string, subnetId: string, containerNames: string[], rpcUrls: string[] = [], down = false): Promise<void> {
    console.log(`Deploying to node ${ip}...`);

    const sshKeyPath = path.resolve("./id_ed25519");

    try {
        // Ensure key has correct permissions
        await execAsync(`chmod 600 ${sshKeyPath}`);

        // Copy compose.yml file to the node using the flags that worked
        console.log("Copying compose.yml...");
        await execAsync(`scp -F /dev/null -o IdentitiesOnly=yes -i ${sshKeyPath} -o StrictHostKeyChecking=no compose.yml ubuntu@${ip}:~/`);

        // If down is true, stop and remove existing containers first
        if (down) {
            console.log("Stopping existing containers...");
            await execAsync(`ssh -F /dev/null -o IdentitiesOnly=yes -i ${sshKeyPath} -o StrictHostKeyChecking=no ubuntu@${ip} "cd ~/ && docker compose down --remove-orphans"`);
        }

        // Run compose directly via SSH with subnetId variable
        console.log("Starting compose...");
        await execAsync(`ssh -F /dev/null -o IdentitiesOnly=yes -i ${sshKeyPath} -o StrictHostKeyChecking=no ubuntu@${ip} "cd ~/ && export subnetId='${subnetId}' && export RPC_URLS_COMBINED='${rpcUrls.join(',')}' && export PUBLIC_IPV4='${ip}' && docker compose up -d --remove-orphans ${containerNames.join(' ')}"`);

        console.log(`Successfully deployed to ${ip}`);
    } catch (error) {
        console.error(`Error deploying to ${ip}:`, error);
    }
}

export const RPC_ENDPOINT = "https://api.avax-test.network"

export function loadPrivateKey() {
    const seedPrivateKeyHex = process.env.SEED_PRIVATE_KEY_HEX || ""
    const privateKey = utils.hexToBuffer(seedPrivateKeyHex)
    return privateKey
}

export function getPChainAddress(privateKey: Uint8Array) {
    const publicKey = secp256k1.getPublicKey(privateKey);

    const address = utils.formatBech32(
        'fuji',
        secp256k1.publicKeyBytesToAddress(publicKey),
    );

    return `P-${address}`
}

export const addTxSignatures = async ({
    unsignedTx,
    privateKeys,
}: {
    unsignedTx: UnsignedTx;
    privateKeys: Uint8Array[];
}) => {
    const unsignedBytes = unsignedTx.toBytes();

    await Promise.all(
        privateKeys.map(async (privateKey) => {
            const publicKey = secp256k1.getPublicKey(privateKey);

            if (unsignedTx.hasPubkey(publicKey)) {
                const signature = await secp256k1.sign(unsignedBytes, privateKey);
                unsignedTx.addSignature(signature);
            }
        }),
    );
};


export const addSigToAllCreds = async (
    unsignedTx: UnsignedTx,
    privateKey: Uint8Array,
) => {
    const unsignedBytes = unsignedTx.toBytes();
    const publicKey = secp256k1.getPublicKey(privateKey);

    if (!unsignedTx.hasPubkey(publicKey)) {
        return;
    }
    const signature = await secp256k1.sign(unsignedBytes, privateKey);

    for (let i = 0; i < unsignedTx.getCredentials().length; i++) {
        unsignedTx.addSignatureAt(signature, i, 0);
    }
};
