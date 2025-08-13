import { useEffect, useState } from "react"

declare global {
    // Define the known request types for the snap
    type SnapRequestMethod =
        | { method: 'avalanche_getAccountPubKey' }
        | {
            method: 'avalanche_sendTransactionJSON';
            params: {
                transactionJSON: string,
                chainAlias: "P",
            }
        }

    // Define the response type based on the request method using conditional types
    type SnapRequestResponse<T extends SnapRequestMethod> =
        T extends { method: 'avalanche_getAccountPubKey' } ? { xp: string; evm: string } :
        T extends { method: 'avalanche_sendTransactionJSON' } ? string :
        never;

    interface Window {
        ethereum: {
            request(args: { method: "eth_requestAccounts" }): Promise<string[]>;
            request(args: {
                method: "wallet_requestSnaps";
                params: Record<string, unknown>;
            }): Promise<Record<string, unknown>>;
            // Updated wallet_snap definition using generics and conditional types
            request<T extends SnapRequestMethod>(args: {
                method: "wallet_snap";
                params: { snapId: string; request: T };
            }): Promise<SnapRequestResponse<T>>;
        }
    }
}

const Button = ({ onClick, children }: { onClick: () => void, children: React.ReactNode }) => {
    return <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-4 mb-4 cursor-pointer" onClick={onClick}>{children}</button>
}

import { Context, pvm, secp256k1, utils } from '@avalabs/avalanchejs';

function App() {
    const [localError, setLocalError] = useState<string | null>(null)
    const [isConnected, setIsConnected] = useState<boolean>(false)
    const [pubKey, setPubKey] = useState<string | null>(null)
    const [pChainAddress, setPChainAddress] = useState<string | null>(null)
    const [txId, setTxId] = useState<string | null>(null)

    useEffect(() => {
        if (isConnected) getAccountPubKey()
    }, [isConnected])

    useEffect(() => {
        if (pubKey) {
            const pubKeyBytes = utils.hexToBuffer(pubKey.replace('0x', ''))
            setPChainAddress('P-' + utils.formatBech32(
                'fuji',
                secp256k1.publicKeyBytesToAddress(pubKeyBytes),
            ))
        }
    }, [pubKey])

    async function connect() {
        try {
            await window.ethereum.request({
                method: "eth_requestAccounts",
            })
            setIsConnected(true)
        } catch (error) {
            setLocalError((error as Error)?.message || "Unknown error")
        }
    }

    async function reinstallSnap() {
        try {
            await window.ethereum.request({
                method: "wallet_requestSnaps",
                params: {
                    "local:http://localhost:8080": {},
                },
            })
        } catch (error) {
            setLocalError((error as Error)?.message || "Unknown error")
        }
    }

    async function getAccountPubKey() {
        window.ethereum.request({
            method: "wallet_snap",
            params: {
                snapId: "local:http://localhost:8080",
                request: {
                    method: "avalanche_getAccountPubKey",
                },
            },
        })
            .then((response) => setPubKey(response.xp))
            .catch((error: Error) => setLocalError(error?.message || "Unknown error"))
    }

    async function sendTransaction() {
        if (!pChainAddress) throw new Error("PChain address not found")

        const pvmApi = new pvm.PVMApi("https://api.avax-test.network");
        const feeState = await pvmApi.getFeeState();
        const context = await Context.getContextFromURI("https://api.avax-test.network");

        const { utxos } = await pvmApi.getUTXOs({
            addresses: [pChainAddress]
        });

        const tx = pvm.e.newCreateSubnetTx({
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            utxos,
            subnetOwners: [utils.bech32ToBytes(pChainAddress)],
        }, context);

        const txId = await window.ethereum.request({
            method: 'wallet_snap',
            params: {
                snapId: "local:http://localhost:8080",
                request: {
                    method: "avalanche_sendTransactionJSON",
                    params: {
                        transactionJSON: JSON.stringify(tx.toJSON()),
                        chainAlias: 'P',
                    }
                }
            }
        }) as string;

        setTxId(txId)
    }

    if (!window.ethereum) return <div>No Ethereum provider found</div>
    if (!isConnected) return <div className="m-4"><Button onClick={connect}>Connect</Button></div>

    return (
        <>
            <div className="m-4">
                {localError && <div className="text-red-500 my-4">{localError}</div>}
                <Button onClick={reinstallSnap}>Reinstall Snap</Button>
                <Button onClick={getAccountPubKey}>Get Account PubKey</Button>
                <Button onClick={sendTransaction}>Send Transaction</Button>
                <div className="m-4">PubKey: {pubKey}</div>
                <div className="m-4">PChain Address: {pChainAddress}</div>
                <div className="m-4">TxId: {txId}</div>
            </div>
        </>
    )
}

export default App
