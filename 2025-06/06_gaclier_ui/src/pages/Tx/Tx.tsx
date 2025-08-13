import { useQuery } from "@tanstack/react-query";
import { Avalanche } from "@avalanche-sdk/data";
import type { GetTransactionResponse } from "@avalanche-sdk/data/models/components";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import BlockElement from "../Block/BlockElement";
import TxElement from "./TxElement";

const fetchTx = async (txHash: string): Promise<GetTransactionResponse> => {
    const avalanche = new Avalanche({
        chainId: "43114",
        network: "mainnet",
    });

    const data = await avalanche.data.evm.transactions.get({
        txHash: txHash,
    });

    console.log(`Got data for tx ${txHash}`, data);

    return data;
};

export default function Tx() {
    const { txHash } = useParams<{ txHash: string }>();
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery({
        queryKey: ["tx", txHash],
        queryFn: () => fetchTx(txHash!),
        enabled: !!txHash,
        retry: false, // Don't retry on error, go straight to 404
    });

    useEffect(() => {
        if (error || (!isLoading && !data)) {
            if (error) {
                console.error("Error fetching tx", error);
            }
            navigate("/404", { replace: true });
        }
    }, [error, data, isLoading, navigate]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <div className="text-gray-600">Loading transaction...</div>
                </div>
            </div>
        );
    }

    if (!data) return null; // Will redirect via useEffect

    return <TxElement tx={data} />;
}
