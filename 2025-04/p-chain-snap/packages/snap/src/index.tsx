import { SLIP10Node } from '@metamask/key-tree';
import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';
import {
    pvm,
    secp256k1,
    UnsignedTx,
    utils,
} from '@avalabs/avalanchejs';

const addSigToAllCreds = async (
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

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
    origin,
    request,
}) => {
    const { privateKeyBytes } = await SLIP10Node.fromJSON(await snap.request({
        method: 'snap_getBip32Entropy',
        params: {
            path: [`m`, `44'`, `9000'`, `0'`],
            curve: 'secp256k1'
        }
    }));

    if (!privateKeyBytes) {
        throw new Error('Failed to get private key bytes');
    }

    // Use the avalanchejs library directly for secp256k1 operations
    const secp256k1PublicKeyBytes = secp256k1.getPublicKey(privateKeyBytes);
    const address = utils.formatBech32(
        'fuji',
        secp256k1.publicKeyBytesToAddress(secp256k1PublicKeyBytes),
    );

    console.log('secp256k1 Private Key:', utils.bufferToHex(privateKeyBytes));
    console.log('secp256k1 Public Key:', utils.bufferToHex(secp256k1PublicKeyBytes));
    console.log('Derived Address:', address);

    switch (request.method) {
        case 'avalanche_getAccountPubKey':
            return {
                xp: utils.bufferToHex(secp256k1PublicKeyBytes), // No 0x prefix as requested
                evm: ""
            };
        case 'avalanche_sendTransactionJSON':
            const params = request.params as { transactionJSON: string, chainAlias: string };
            console.log('avalanche_sendTransactionJSON params', params);
            if (params.chainAlias !== "P") {
                throw new Error("Only P chain is supported. Please set the chainAlias to P.");
            }
            if (!params.transactionJSON) {
                throw new Error("Transaction hex is required.");
            }

            const unsignedTx = UnsignedTx.fromJSON(params.transactionJSON);

            console.log('unsignedTx', unsignedTx);

            // --- Confirmation Dialog ---
            const confirmation = await snap.request({
                method: 'snap_dialog',
                params: {
                    type: 'confirmation',
                    content: (
                        <Box>
                            <Text>
                                Please confirm signing and issuing the P-Chain transaction from:
                            </Text>
                            <Text>
                                From: <Bold> {address}</Bold>
                            </Text>
                            <Text>
                                <Bold>Blind signing.</Bold> We have not yet implemented the ability to see the tx before signing.
                            </Text>
                        </Box>
                    ),
                },
            });

            // --- Signing and Issuing ---
            if (!confirmation) {
                throw new Error('Transaction rejected');
            }

            // Sign the transaction
            await addSigToAllCreds(unsignedTx, privateKeyBytes);
            const pvmApi = new pvm.PVMApi("https://api.avax-test.network");
            const txId = await pvmApi.issueSignedTx(unsignedTx.getSignedTx()).then(tx => tx.txID)
            return txId

        default:
            throw new Error('Method not found.');
    }
};

import type { OnHomePageHandler } from "@metamask/snaps-sdk";
import { Heading } from "@metamask/snaps-sdk/jsx";

export const onHomePage: OnHomePageHandler = async () => {
    return {
        content: (
            <Box>
                <Heading>Hello world!</Heading>
                <Text>Welcome to my Snap home page!</Text>
            </Box>
        ),
    };
};
