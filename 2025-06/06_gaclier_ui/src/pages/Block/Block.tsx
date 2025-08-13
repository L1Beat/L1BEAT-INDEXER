import { useQuery } from "@tanstack/react-query";
import { Avalanche } from "@avalanche-sdk/data";
import type { EvmBlock, NativeTransaction } from "@avalanche-sdk/data/models/components";
import BlockElement from "./BlockElement";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const fetchBlock = async (blockId: string): Promise<EvmBlock> => {
    const avalanche = new Avalanche({
        chainId: "43114",
        network: "mainnet",
    });

    return await avalanche.data.evm.blocks.get({
        blockId: blockId,
    });
};

export default function Block() {
    const { blockId } = useParams<{ blockId: string }>();
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery({
        queryKey: ["block", blockId],
        queryFn: () => fetchBlock(blockId!),
        enabled: !!blockId,
        retry: false, // Don't retry on error, go straight to 404
    });

    useEffect(() => {
        if (error || (!isLoading && !data)) {
            navigate("/404", { replace: true });
        }
    }, [error, data, isLoading, navigate]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-600">Loading block...</div>
                </div>
            </div>
        );
    }

    if (!data) return null; // Will redirect via useEffect

    return <BlockElement block={data} />;
}
