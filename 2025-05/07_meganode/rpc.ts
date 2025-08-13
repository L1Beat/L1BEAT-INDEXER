interface ChainOutput {
    assetID: string;
    fxID: string;
    output: {
        addresses: string[];
        amount: number;
        locktime: number;
        threshold: number;
    };
}

interface ChainInput {
    txID: string;
    outputIndex: number;
    assetID: string;
    fxID: string;
    input: {
        amount: number;
        signatureIndices: number[];
    };
}

interface SubnetAuthorization {
    signatureIndices: number[];
}

interface CreateChainUnsignedTx {
    networkID: number;
    blockchainID: string;
    outputs: ChainOutput[];
    inputs: ChainInput[];
    memo: string;
    subnetID: string;
    chainName: string;
    vmID: string;
    fxIDs: string[];
    genesisData: string;
    subnetAuthorization: SubnetAuthorization;
}

interface Credential {
    signatures: string[];
}

interface CreateChainTx {
    unsignedTx: CreateChainUnsignedTx;
    credentials: Credential[];
    id: string;
}

interface GetChainResponse {
    jsonrpc: string;
    result: {
        tx: CreateChainTx;
        encoding: string;
    };
    id: number;
}

interface JsonRpcRequest {
    jsonrpc: string;
    method: string;
    params: {
        txID: string;
        encoding: string;
    };
    id: number;
}

async function getChain(chainId: string): Promise<CreateChainTx> {
    // Shuffle endpoints and take first 3
    const shuffledEndpoints = [...pChainEndpoints].sort(() => Math.random() - 0.5).slice(0, 3);

    // Try each endpoint up to 3 times
    for (const endpoint of shuffledEndpoints) {
        try {
            return await getChainWithEndpoint(endpoint, chainId);
        } catch (error) {
            console.error(`Error fetching chain from ${endpoint}:`, String(error).slice(0, 100));
            continue;
        }
    }

    throw new Error("All endpoints failed after retries");
}

async function getChainWithEndpoint(endpoint: string, chainId: string): Promise<CreateChainTx> {
    const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        method: "platform.getTx",
        params: {
            txID: chainId,
            encoding: "json"
        },
        id: 1
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GetChainResponse = await response.json() as GetChainResponse;

    if (!data.result || !data.result.tx) {
        throw new Error("Invalid response: missing transaction data");
    }

    return data.result.tx;
}

export { getChain, type CreateChainTx, type CreateChainUnsignedTx, type ChainOutput, type ChainInput };


interface Blockchain {
    createBlockTimestamp: number;
    createBlockNumber: string;
    blockchainId: string;
    vmId: string;
    subnetId: string;
    blockchainName: string;
    evmChainId?: number; // Based on the example, this can be missing
}

interface ApiResponse {
    blockchains: Blockchain[];
    nextPageToken?: string;
}

async function fetchChainsPage(nextPageToken?: string): Promise<ApiResponse> {
    console.log("fetching chains page", nextPageToken);
    const pageSize = 100;
    let url = `https://glacier-api.avax.network/v1/networks/mainnet/blockchains?pageSize=${pageSize}`;
    if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch chains: ${response.statusText}`);
    }
    return response.json() as Promise<ApiResponse>;
}

export async function fetchAllChains() {
    const allBlockchains: Blockchain[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
        const page = await fetchChainsPage(nextPageToken);
        allBlockchains.push(...page.blockchains);
        nextPageToken = page.nextPageToken;
    } while (nextPageToken);

    return allBlockchains; // Optionally return all blockchains if needed elsewhere
}

interface Owner {
    locktime: string;
    threshold: string;
    addresses: string[];
}

interface Validator {
    validationID: string;
    nodeID: string;
    publicKey: string;
    remainingBalanceOwner: Owner;
    deactivationOwner: Owner;
    startTime: string;
    weight: string;
    minNonce: string;
    balance: string;
}

interface GetCurrentValidatorsResponse {
    jsonrpc: string;
    result: {
        validators: Validator[];
    };
    id: number;
}

interface ValidatorsRequest {
    jsonrpc: string;
    method: string;
    params: {};
    id: number;
}

const pChainEndpoints = [
    "https://avalanche-p-chain-rpc.publicnode.com",
    "https://ava-mainnet.public.blastapi.io/ext/P",
    "https://lb.nodies.app/v1/105f8099e80f4123976b59df1ebfb433/ext/bc/P",
    "https://1rpc.io/avax/p",
    "https://api.avax.network/ext/bc/P"
];

async function getCurrentValidators(subnetId: string): Promise<Validator[]> {
    // Shuffle endpoints and take first 3
    const shuffledEndpoints = [...pChainEndpoints].sort(() => Math.random() - 0.5).slice(0, 3);


    // Try each endpoint up to 3 times
    for (const endpoint of shuffledEndpoints) {
        try {
            return await getCurrentValidatorsWithEndpoint(endpoint, subnetId);
        } catch (error) {
            console.error(`Error fetching validators from ${endpoint}:`, String(error).slice(0, 100));
            continue
        }
    }

    throw new Error("All endpoints failed after retries");
}

async function getCurrentValidatorsWithEndpoint(endpoint: string, subnetId: string): Promise<Validator[]> {
    const request: ValidatorsRequest = {
        jsonrpc: "2.0",
        method: "platform.getCurrentValidators",
        params: {
            subnetID: subnetId
        },
        id: 1
    };

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GetCurrentValidatorsResponse = await response.json() as GetCurrentValidatorsResponse;

    if (!data.result || !data.result.validators) {
        throw new Error("Invalid response: missing validators data");
    }

    return data.result.validators;
}

export { getCurrentValidators, fetchSubnet, type Validator, type Owner, type SubnetInfo, type SubnetOwnershipInfo };

interface SubnetOwnershipInfo {
    addresses: string[];
    locktime: number;
    threshold: number;
}

interface SubnetInfo {
    createBlockTimestamp: number;
    createBlockIndex: string;
    subnetId: string;
    ownerAddresses: string[];
    threshold: number;
    locktime: number;
    subnetOwnershipInfo: SubnetOwnershipInfo;
    isL1: boolean;
    blockchains: Blockchain[];
}

async function fetchSubnet(subnetId: string): Promise<SubnetInfo> {
    const url = `https://glacier-api.avax.network/v1/networks/mainnet/subnets/${subnetId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch subnet: ${response.statusText}`);
    }

    return response.json() as Promise<SubnetInfo>;
}
