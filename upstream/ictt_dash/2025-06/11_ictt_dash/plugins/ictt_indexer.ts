import { type IndexingPlugin, abiUtils, encodingUtils, evmTypes, viem } from "frostbyte-sdk";
import ERC20TokenHome from './abi/ERC20TokenHome.json';
import NativeTokenHome from './abi/NativeTokenHome.json';
// TEMPORARILY COMMENTED OUT - Only indexing Home contracts
// import ERC20TokenRemote from './abi/ERC20TokenRemote.json';
// import NativeTokenRemote from './abi/NativeTokenRemote.json';
import type { ContractHomeData, RemoteData } from './types/ictt.types';

interface ContractHomeRow {
    address: string;
    data: string; // JSON string from SQLite
}

interface PendingRegistration {
    contractAddress: string;
    coinAddress: string;
    tokenDecimals: number;
    contractType: 'ERC20Home' | 'NativeHome' | 'ERC20Remote' | 'NativeRemote';
}

interface RecognizedHome {
    contract_address: string;
    coin_address: string;
    token_decimals: number;
    contract_type: string;
    at_least_one_remote_registered: number; // SQLite boolean (0/1)
}

interface TokenMovement {
    blockTimestamp: number;
    isInbound: boolean;
    amount: bigint;
    pairChain: string;
    contractAddress: string;
    txHash: string;
}

interface ContractTypeDetection {
    contractType: 'ERC20Home' | 'NativeHome' | 'ERC20Remote' | 'NativeRemote';
    decoded: any[];
    coinAddress: string;
    tokenDecimals: number;
}

/**
 * Decodes constructor parameters from a contract creation transaction
 * @param txInput - The full transaction input data (bytecode + constructor params)
 * @param abi - The contract ABI
 * @returns Decoded constructor parameters or null if decoding fails
 */
const decodeConstructorParams = (txInput: string, abi: viem.Abi): any[] | null => {
    // Find the constructor in the ABI
    const constructorAbi = abi.find(
        (item) => item.type === 'constructor'
    ) as viem.AbiItem & { inputs?: viem.AbiParameter[] };

    if (!constructorAbi || !constructorAbi.inputs || constructorAbi.inputs.length === 0) {
        console.error("Constructor ABI not found or has no inputs");
        return null;
    }

    // For simple types (address, uint, etc), each parameter is 32 bytes (64 hex chars)
    // This is a simplified approach that works for most cases
    // TODO: Handle dynamic types (strings, arrays) properly
    const constructorParamsLength = constructorAbi.inputs.length * 64;

    // Extract constructor params from the end of the input
    const constructorParams = `0x${txInput.slice(-constructorParamsLength)}` as `0x${string}`;

    // Decode the constructor parameters
    const decoded = viem.decodeAbiParameters(
        constructorAbi.inputs,
        constructorParams
    );

    return decoded;
};

/**
 * Detects ICTT contract type from deployment transaction and decodes constructor parameters
 * @param txInput - The full transaction input data (bytecode + constructor params)
 * @param contractAddress - The deployed contract address (for logging)
 * @returns Contract type detection result or null if not an ICTT contract
 */
const detectICTTContract = (txInput: string, contractAddress: string): ContractTypeDetection | null => {
    const contractsToCheck = [
        {
            type: 'ERC20Home' as const,
            abi: ERC20TokenHome.abi as viem.Abi,
            expectedParams: 5,
            getCoinAddress: (decoded: any[]) => decoded[3] as string, // tokenAddress
            getTokenDecimals: (decoded: any[]) => Number(decoded[4]) // tokenDecimals
        },
        {
            type: 'NativeHome' as const,
            abi: NativeTokenHome.abi as viem.Abi,
            expectedParams: 4,
            getCoinAddress: (decoded: any[]) => decoded[3] as string, // wrappedTokenAddress
            getTokenDecimals: () => 18 // Always 18 for native tokens
        },
        // TEMPORARILY COMMENTED OUT - Only indexing Home contracts
        // {
        //     type: 'ERC20Remote' as const,
        //     abi: ERC20TokenRemote.abi as viem.Abi,
        //     expectedParams: 4, // settings (tuple), tokenName, tokenSymbol, tokenDecimals
        //     getCoinAddress: () => '0x0000000000000000000000000000000000000000', // No specific token on remote
        //     getTokenDecimals: (decoded: any[]) => Number(decoded[3]) // tokenDecimals
        // },
        // {
        //     type: 'NativeRemote' as const,
        //     abi: NativeTokenRemote.abi as viem.Abi,
        //     expectedParams: 4, // settings (tuple), nativeAssetSymbol, initialReserveImbalance, burnedFeesReportingRewardPercentage
        //     getCoinAddress: () => '0x0000000000000000000000000000000000000000', // Native on remote
        //     getTokenDecimals: () => 18 // Always 18 for native tokens
        // }
    ];

    for (const contractDef of contractsToCheck) {
        try {
            const decoded = decodeConstructorParams(txInput, contractDef.abi);
            if (decoded && decoded.length === contractDef.expectedParams) {
                const tokenDecimals = contractDef.getTokenDecimals(decoded);

                // Sanity check for decimals
                if (tokenDecimals > 0 && tokenDecimals < 100) {
                    return {
                        contractType: contractDef.type,
                        decoded,
                        coinAddress: contractDef.getCoinAddress(decoded),
                        tokenDecimals
                    };
                }
            }
        } catch (error) {
            // Continue to next contract type
        }
    }

    return null;
};



// Combine event hashes from all ABIs
const events: Map<string, string> = new Map();

// Home contract events (these are what we track in this indexer)
const homeAbis = [
    ERC20TokenHome.abi as abiUtils.AbiItem[],
    NativeTokenHome.abi as abiUtils.AbiItem[]
];

for (const abi of homeAbis) {
    const abiEvents = abiUtils.getEventHashesMap(abi);
    for (const [hash, name] of abiEvents) {
        events.set(hash, name);
    }
}

// Add MessageExecuted event hash manually (from TeleporterMessenger)
const TELEPORTER_MESSAGE_EXECUTED_HASH = '0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c';
// MessageExecuted(bytes32 indexed messageID, bytes32 indexed sourceBlockchainID)
events.set(TELEPORTER_MESSAGE_EXECUTED_HASH, 'MessageExecuted');

const eventHexes = Array.from(events.keys());


const module: IndexingPlugin = {
    name: "ictt",
    version: 9,
    usesTraces: false,
    filterEvents: [
        ...eventHexes,
        evmTypes.CONTRACT_CREATION_TOPIC
    ],

    initialize: (db) => {
        //FIXME: add undexes if slow. For now full table scan is ok.
        db.exec(`
            CREATE TABLE IF NOT EXISTS token_movements(
                block_timestamp INTEGER NOT NULL, 
                is_inbound BOOLEAN NOT NULL,
                amount REAL NOT NULL,
                pair_chain TEXT NOT NULL,
                contract_address TEXT NOT NULL,
                tx_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recognized_token_homes(
                contract_address TEXT NOT NULL,
                coin_address TEXT NOT NULL,
                token_decimals INTEGER NOT NULL,
                contract_type TEXT NOT NULL,
                at_least_one_remote_registered BOOLEAN NOT NULL DEFAULT 0,
                PRIMARY KEY (contract_address)
            );
        `);
    },

    handleTxBatch: (db, blocksDb, batch) => {
        const pendingRegistrations: PendingRegistration[] = [];
        const movements: TokenMovement[] = [];
        const homesWithRemoteRegistered: Set<string> = new Set();

        // Load all recognized homes into memory for quick lookup
        const recognizedHomes = new Map<string, RecognizedHome>();
        //FIXME: pull on demand if throws out of memory on the C-Chain
        const existingHomes = db.prepare('SELECT * FROM recognized_token_homes').all() as RecognizedHome[];
        for (const home of existingHomes) {
            recognizedHomes.set(home.contract_address, home);
        }

        // First pass: Collect all deployments and events
        for (const { tx, receipt, blockTs } of batch.txs) {


            // Check if this is a contract creation
            if (receipt.contractAddress) {
                const contractAddress = receipt.contractAddress;
                const detection = detectICTTContract(tx.input as string, contractAddress);

                // Log unknown contracts for debugging
                if (detection) {
                    pendingRegistrations.push({
                        contractAddress: contractAddress,
                        coinAddress: detection.coinAddress,
                        tokenDecimals: detection.tokenDecimals,
                        contractType: detection.contractType
                    });

                    recognizedHomes.set(contractAddress, {
                        contract_address: contractAddress,
                        coin_address: detection.coinAddress,
                        token_decimals: detection.tokenDecimals,
                        contract_type: detection.contractType,
                        at_least_one_remote_registered: 0
                    });
                }
            }

            // Check for ICTT events
            for (const log of receipt.logs) {
                const eventName = events.get(log.topics[0] || "");
                if (!eventName) continue;

                // Handle RemoteRegistered event to update flag
                if (eventName === "RemoteRegistered") {
                    console.log(`------------ RemoteRegistered event found for contract: ${log.address}`);
                    homesWithRemoteRegistered.add(log.address);
                }

                const contractAddress = log.address;

                // Only process events for recognized home contracts
                if (!recognizedHomes.has(contractAddress)) {
                    continue;
                }

                // Handle outbound token movement events
                const outboundEvents = ["TokensSent", "TokensAndCallSent"];

                if (outboundEvents.includes(eventName)) {
                    // Decode event arguments (try both ABIs)
                    let args;
                    try {
                        args = viem.decodeEventLog({
                            abi: ERC20TokenHome.abi as abiUtils.AbiItem[],
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        }).args as any;
                    } catch {
                        args = viem.decodeEventLog({
                            abi: NativeTokenHome.abi as abiUtils.AbiItem[],
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        }).args as any;
                    }

                    const pairChain = encodingUtils.hexToCB58(args.input.destinationBlockchainID);
                    const amount = args.amount;

                    movements.push({
                        blockTimestamp: blockTs,
                        isInbound: false,
                        amount: amount,
                        pairChain: pairChain,
                        contractAddress: contractAddress,
                        txHash: tx.hash
                    });
                }

                // Handle inbound transfers via CallSucceeded
                if (eventName === "CallSucceeded") {
                    // Decode CallSucceeded event
                    let args;
                    try {
                        args = viem.decodeEventLog({
                            abi: ERC20TokenHome.abi as abiUtils.AbiItem[],
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        }).args as any;
                    } catch {
                        args = viem.decodeEventLog({
                            abi: NativeTokenHome.abi as abiUtils.AbiItem[],
                            data: log.data as `0x${string}`,
                            topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
                        }).args as any;
                    }

                    // Look for MessageExecuted event in the same receipt to get source blockchain
                    let sourceBlockchainID: string | null = null;
                    for (const otherLog of receipt.logs) {
                        if (otherLog.topics[0] === TELEPORTER_MESSAGE_EXECUTED_HASH) {
                            // This is a MessageExecuted event
                            // sourceBlockchainID is the second indexed parameter (topics[2])
                            if (otherLog.topics[2]) {
                                sourceBlockchainID = otherLog.topics[2];
                                break;
                            }
                        }
                    }

                    if (sourceBlockchainID) {
                        const pairChain = encodingUtils.hexToCB58(sourceBlockchainID);
                        const amount = args.amount;

                        movements.push({
                            blockTimestamp: blockTs,
                            isInbound: true,
                            amount: amount,
                            pairChain: pairChain,
                            contractAddress: contractAddress,
                            txHash: tx.hash
                        });
                    }
                }
            }
        }

        // Database operations

        // 1. Register pending contracts (from constructor)
        if (pendingRegistrations.length > 0) {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO recognized_token_homes 
                (contract_address, coin_address, token_decimals, contract_type, at_least_one_remote_registered) 
                VALUES (?, ?, ?, ?, 0)
            `);

            for (const reg of pendingRegistrations) {
                stmt.run(reg.contractAddress, reg.coinAddress, reg.tokenDecimals, reg.contractType);
            }
        }

        // 2. Record all token movements
        if (movements.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO token_movements 
                (block_timestamp, is_inbound, amount, pair_chain, contract_address, tx_hash) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const movement of movements) {
                // Already verified contract is recognized in event processing
                const contractInfo = recognizedHomes.get(movement.contractAddress)!;
                const decimals = contractInfo.token_decimals;
                const divisor = BigInt(10) ** BigInt(decimals);

                // Perform division in bigint space to avoid overflow, then convert to Number
                // For extra precision, we'll keep some decimal places during bigint division
                const scaleFactor = BigInt(1e9); // Keep 9 decimal places for precision
                const scaledAmount = (movement.amount * scaleFactor) / divisor;
                const humanAmount = Number(scaledAmount) / 1e9;

                insertStmt.run(
                    movement.blockTimestamp,
                    movement.isInbound ? 1 : 0,
                    humanAmount,
                    movement.pairChain,
                    movement.contractAddress,
                    movement.txHash
                );
            }
        }

        // 3. Update at_least_one_remote_registered flag for buffered contracts
        if (homesWithRemoteRegistered.size > 0) {
            const updateStmt = db.prepare(`
                UPDATE recognized_token_homes 
                SET at_least_one_remote_registered = 1 
                WHERE contract_address = ? AND at_least_one_remote_registered = 0
            `);
            for (const contractAddress of homesWithRemoteRegistered) {
                updateStmt.run(contractAddress);
            }
        }
    }

}

export default module;
