import { useQuery } from "@tanstack/react-query";
import LatestBlocks from "./LatestBlocks";
import LatestTransactions from "./LatestTransactions";
import { Avalanche } from "@avalanche-sdk/data";
import type { EvmBlock, NativeTransaction } from "@avalanche-sdk/data/models/components";

const fetchLatestData = async (pageSize: number = 10): Promise<{ blocks: EvmBlock[], transactions: NativeTransaction[] }> => {
    const avalanche = new Avalanche({
        chainId: "43114",
        network: "mainnet",
    });

    const [blocksResult, transactionsResult] = await Promise.all([
        avalanche.data.evm.blocks.listLatest({
            pageToken: undefined,
            pageSize: pageSize,
            chainId: undefined,
        }),
        avalanche.data.evm.transactions.listLatest({
            pageToken: undefined,
            pageSize: pageSize,
            chainId: undefined,
        })
    ]);

    return {
        blocks: blocksResult.result.blocks,
        transactions: transactionsResult.result.transactions
    };
};

function Home() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['latest-data-pageSize-20'],
        queryFn: () => fetchLatestData(20),
        staleTime: 60 * 1000, // Data considered fresh for 1 minute
        refetchInterval: 5 * 1000, // Refetch every 5 seconds
    });

    const blocks = data?.blocks || [];
    const transactions = data?.transactions || [];

    if (isLoading) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="text-center">Loading latest data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="text-center text-red-500">
                    Error loading data: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                <div>
                    <LatestBlocks blocks={blocks} />
                </div>
                <div>
                    <LatestTransactions transactions={transactions} />
                </div>
            </div>
        </div>
    );
}

export default Home; 
