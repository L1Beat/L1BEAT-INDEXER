export type GlacierChain = {
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
    isTestnet: boolean;
    utilityAddresses: Record<string, unknown>;
    networkToken: {
        name: string;
        symbol: string;
        decimals: number;
        logoUri: string;
        description: string;
    };
    chainLogoUri: string;
    private: boolean;
    enabledFeatures: unknown[];
};

export async function getGlacierChains(network: 'mainnet' | 'testnet'): Promise<GlacierChain[]> {
    const response = await fetch(`https://glacier-api.avax.network/v1/chains?network=${network}`, {
        headers: {
            'accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Glacier chains: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { chains: GlacierChain[] };
    return data.chains;
}

export type GlacierBlockchain = {
    createBlockTimestamp: number;
    createBlockNumber: string;
    blockchainId: string;
    vmId: string;
    subnetId: string;
    blockchainName: string;
    evmChainId: number;
};

export async function listAllBlockchains(network: 'mainnet' | 'testnet' = 'mainnet'): Promise<GlacierBlockchain[]> {
    const pageSize = 100;
    let pageToken: string | undefined = undefined;
    let allBlockchains: GlacierBlockchain[] = [];
    while (true) {
        const url = new URL(`https://glacier-api.avax.network/v1/networks/${network}/blockchains`);
        url.searchParams.set('pageSize', pageSize.toString());
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
        if (!response.ok) throw new Error(`Failed to fetch blockchains: ${response.status} ${response.statusText}`);
        const data = await response.json() as { blockchains: GlacierBlockchain[], nextPageToken?: string };
        allBlockchains = allBlockchains.concat(data.blockchains);
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
    }
    return allBlockchains;
}
