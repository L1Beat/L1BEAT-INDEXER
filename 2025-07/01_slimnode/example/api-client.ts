interface NodeInfo {
    result?: {
        nodeID: string;
        nodePOP: {
            publicKey: string;
            proofOfPossession: string;
        };
    };
}

interface NodeAssignment {
    nodeIndex: number;
    nodeInfo: NodeInfo;
    dateCreated: number;
    expiresAt: number;
}

interface SubnetStatusResponse {
    subnetId: string;
    nodes: NodeAssignment[];
}

interface ErrorResponse {
    error: string;
}

export class ApiClient {
    constructor(private baseUrl: string, private password: string) {
        if (!baseUrl) throw new Error('baseUrl is required');
        if (!password) throw new Error('password is required');
    }

    async getSubnetStatus(subnetId: string): Promise<SubnetStatusResponse> {
        const response = await fetch(`${this.baseUrl}/node_admin/subnets/status/${subnetId}?password=${this.password}`);
        if (!response.ok) {
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    async addNodeToSubnet(subnetId: string): Promise<SubnetStatusResponse> {
        const response = await fetch(`${this.baseUrl}/node_admin/subnets/add/${subnetId}?password=${this.password}`, {
            method: 'POST'
        });
        if (!response.ok) {
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    async removeNodeFromSubnet(subnetId: string, nodeIndex: number): Promise<SubnetStatusResponse> {
        const response = await fetch(`${this.baseUrl}/node_admin/subnets/delete/${subnetId}/${nodeIndex}?password=${this.password}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    async checkRpcStatus(chainId: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/ext/bc/${chainId}/rpc`);
        if (!response.ok) {
            if (response.status === 503) {
                return await response.text();
            }
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.text();
    }

    async sendRpcRequest(chainId: string, body: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/ext/bc/${chainId}/rpc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const error = await response.json() as ErrorResponse;
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    getRpcUrl(chainId: string): string {
        return `${this.baseUrl}/ext/bc/${chainId}/rpc`;
    }
}
