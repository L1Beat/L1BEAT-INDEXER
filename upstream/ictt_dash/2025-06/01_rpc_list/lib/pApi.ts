import pThrottle from "p-throttle";

const pChainEndpoints = [
    // "https://meganode.solokhin.com/ext/bc/P",
    "https://avalanche-p-chain-rpc.publicnode.com",
    "https://ava-mainnet.public.blastapi.io/ext/P",
    "https://lb.nodies.app/v1/105f8099e80f4123976b59df1ebfb433/ext/bc/P",
    "https://1rpc.io/avax/p",
    "https://api.avax.network/ext/bc/P",
];


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

const throttle = pThrottle({
    limit: 30,
    interval: 1000
});

let requestsLeft = 0
setInterval(() => {
    if (requestsLeft > 0) {
        console.log(`P-Chain requests left: ${requestsLeft}`)
    }
}, 1000)

export async function isValidated(subnetId: string): Promise<boolean> {
    try {
        requestsLeft += 1
        return await throttle(isValidatedUnthrottled)(subnetId);
    } finally {
        requestsLeft -= 1
    }
}

async function isValidatedUnthrottled(subnetId: string): Promise<boolean> {
    const validators = await getCurrentValidators(subnetId);
    return validators.filter(val => val.balance !== "0").length > 0;
}

async function getCurrentValidators(subnetId: string): Promise<Validator[]> {
    for (const endpoint of pChainEndpoints) {
        try {
            return await getCurrentValidatorsWithEndpoint(endpoint, subnetId);
        } catch (error) {
            console.error(`Error fetching validators from ${endpoint}:`, String(error).slice(0, 100));
            continue
        }
    }

    throw new Error("All endpoints failed after retries");
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


async function getCurrentValidatorsWithEndpoint(endpoint: string, subnetId: string): Promise<Validator[]> {
    const request: ValidatorsRequest = {
        jsonrpc: "2.0",
        method: "platform.getCurrentValidators",
        params: {
            subnetID: subnetId
        },
        id: 1
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 1000);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(request),
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GetCurrentValidatorsResponse = await response.json() as GetCurrentValidatorsResponse;

    if (!data.result || !data.result.validators) {
        throw new Error("Invalid response: missing validators data");
    }

    return data.result.validators;
}
