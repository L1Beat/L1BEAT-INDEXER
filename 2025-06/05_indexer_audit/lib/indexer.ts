export interface IndexerStatus {
    latestBlockNumber: number;
    lastUpdatedTimestamp: number;
    healthy: boolean;
    lastProcessedBlock: number;
    caughtUp: boolean;
    totalTxCount: number;
}

export interface MetricPoint {
    timestamp: number;
    value: number;
}

export class IndexerClient {
    constructor(private readonly baseUrl: string) { }

    async getStatus(): Promise<IndexerStatus> {
        const response = await fetch(`${this.baseUrl}/api/status`);
        return response.json();
    }

    async getTxCountMetrics(limit: number = 5): Promise<MetricPoint[]> {
        const response = await fetch(`${this.baseUrl}/api/metrics/1m/tx-count?limit=${limit}`);
        return response.json();
    }
}
