export type RemoteData = {
    initialCollateralNeeded: boolean;
    tokenDecimals: number;
    // Remote event counts and sums
    collateralAddedCnt: number;
    collateralAddedSum: string;
    tokensAndCallRoutedCnt: number;
    tokensAndCallRoutedSum: string;
    tokensAndCallSentCnt: number;
    tokensAndCallSentSum: string;
    tokensRoutedCnt: number;
    tokensRoutedSum: string;
    tokensSentCnt: number;
    tokensSentSum: string;
}

export type ContractHomeData = {
    address: `0x${string}`;
    remotes: {
        [remoteBlockchainId: string]: {
            [remoteTokenAddress: string]: RemoteData
        }
    };
    // Local event counts and sums
    callFailedCnt: number;
    callFailedSum: string;
    callSucceededCnt: number;
    callSucceededSum: string;
    tokensWithdrawnCnt: number;
    tokensWithdrawnSum: string;
}

// For API responses - flattened structure with amounts
export type ContractHomeRemote = {
    remoteBlockchainID: string;
    remoteTokenTransferrerAddress: string;
    initialCollateralNeeded: boolean;
    tokenDecimals: number;
    // Remote event counts and sums
    collateralAddedCnt: number;
    collateralAddedSum: string;
    tokensAndCallRoutedCnt: number;
    tokensAndCallRoutedSum: string;
    tokensAndCallSentCnt: number;
    tokensAndCallSentSum: string;
    tokensRoutedCnt: number;
    tokensRoutedSum: string;
    tokensSentCnt: number;
    tokensSentSum: string;
}

export type ContractHome = {
    address: string;
    remotes: ContractHomeRemote[];
    // Local event counts and sums
    callFailedCnt: number;
    callFailedSum: string;
    callSucceededCnt: number;
    callSucceededSum: string;
    tokensWithdrawnCnt: number;
    tokensWithdrawnSum: string;
} 
