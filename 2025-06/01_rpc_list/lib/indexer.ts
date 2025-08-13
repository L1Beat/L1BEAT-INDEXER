interface IndexerStatus {
    latestBlockNumber: number;
    lastUpdatedTimestamp: number;
    healthy: boolean;
    lastProcessedBlock: number;
    caughtUp: boolean;
    totalTxCount: number;
}

export async function getIndexerStatus(blockchainId: string): Promise<IndexerStatus> {
    const url = `https://${blockchainId}.idx2.solokhin.com/api/status`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data as IndexerStatus;
    } catch (error) {
        throw new Error(`Failed to fetch indexer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
