interface NetworkToken {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
    description: string;
}

interface UtilityAddresses {
    multicall?: string;
    [key: string]: string | undefined;
}

interface GlacierChain {
    chainId: string;
    status: string;
    chainName: string;
    description: string;
    platformChainId: string;
    subnetId: string;
    vmId: string;
    vmName: string;
    explorerUrl: string;
    rpcUrl: string;
    wsUrl?: string;
    isTestnet: boolean;
    utilityAddresses: UtilityAddresses;
    networkToken: NetworkToken;
    chainLogoUri: string;
    private: boolean;
    enabledFeatures: string[];
}

interface GlacierResponse {
    chains: GlacierChain[];
}

interface RpcUrlEntry {
    chainId: string;
    chainName: string;
    rpcUrl: string;
    wsUrl?: string;
    isTestnet: boolean;
}

export async function getGlacierRpcUrls(network: 'mainnet' | 'testnet' = 'mainnet'): Promise<RpcUrlEntry[]> {
    const response = await fetch(`https://glacier-api.avax.network/v1/chains?network=${network}`, {
        headers: {
            'accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Glacier chains: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GlacierResponse;

    return data.chains.map(chain => ({
        chainId: chain.chainId,
        chainName: chain.chainName,
        rpcUrl: chain.rpcUrl,
        ...(chain.wsUrl && { wsUrl: chain.wsUrl }),
        isTestnet: chain.isTestnet
    }));
}

// Usage example:
// const rpcUrls = await getGlacierRpcUrls('mainnet');
// console.log(rpcUrls);
