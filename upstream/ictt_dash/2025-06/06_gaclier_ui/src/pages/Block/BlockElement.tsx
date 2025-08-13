import { Box, Clock, Hash, Zap, Fuel, ArrowUp, ArrowDown, Activity } from "lucide-react";
import type { EvmBlock } from "@avalanche-sdk/data/models/components";
import Ago from "../../components/Ago";
import ShortHash from "../../components/ShortHash";

// Format large numbers with commas
const formatNumber = (value: string | number): string => {
    return Number(value).toLocaleString();
}

// Format gas values (wei to gwei)
const formatGas = (value: string): string => {
    const gwei = Number(value) / 1e9;
    return `${gwei.toFixed(2)} Gwei`;
}

// Format fees (wei to AVAX)
const formatAvax = (value: string): string => {
    const avax = Number(value) / 1e18;
    return `${avax.toFixed(6)} AVAX`;
}

export default function BlockElement({ block }: { block: EvmBlock }) {
    const gasUtilization = (Number(block.gasUsed) / Number(block.gasLimit)) * 100;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center">
                    <div className="h-12 w-12 flex-shrink-0">
                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Box className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                    <div className="ml-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Block #{formatNumber(block.blockNumber)}
                        </h1>
                        <p className="text-sm text-gray-500">
                            Chain ID: {block.chainId}
                        </p>
                    </div>
                </div>
            </div>

            {/* Block Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Timestamp</span>
                            </div>
                            <div className="text-sm text-gray-900 text-right">
                                <code>{block.blockTimestamp}</code>{" "}
                                (<Ago timestamp={block.blockTimestamp * 1000} format="twitter" /> ago)
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Hash className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Block Hash</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <a
                                    href={`/block/${block.blockHash}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    <ShortHash hash={block.blockHash} />
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <ArrowUp className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Parent Hash</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <a
                                    href={`/block/${block.parentHash}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    <ShortHash hash={block.parentHash} />
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Activity className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Transactions</span>
                            </div>
                            <div className="text-sm text-gray-900">
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    {formatNumber(block.txCount)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Cumulative Transactions</span>
                            <div className="text-sm text-gray-900">
                                {formatNumber(block.cumulativeTransactions)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gas Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Gas Information</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Fuel className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Gas Used</span>
                            </div>
                            <div className="text-sm text-gray-900">
                                {formatNumber(block.gasUsed)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Gas Limit</span>
                            <div className="text-sm text-gray-900">
                                {formatNumber(block.gasLimit)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Gas Utilization</span>
                            <div className="text-sm text-gray-900">
                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${gasUtilization > 90
                                    ? 'bg-red-50 text-red-700 ring-red-700/10'
                                    : gasUtilization > 70
                                        ? 'bg-yellow-50 text-yellow-700 ring-yellow-700/10'
                                        : 'bg-green-50 text-green-700 ring-green-700/10'
                                    }`}>
                                    {gasUtilization.toFixed(2)}%
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Base Fee</span>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatGas(block.baseFee)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Gas Cost</span>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatGas(block.gasCost)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Fees Spent</span>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatAvax(block.feesSpent)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gas Utilization Bar */}
            <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Gas Utilization</h3>
                </div>
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500">
                            {formatNumber(block.gasUsed)} / {formatNumber(block.gasLimit)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                            {gasUtilization.toFixed(2)}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${gasUtilization > 90
                                ? 'bg-red-500'
                                : gasUtilization > 70
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                            style={{ width: `${Math.min(gasUtilization, 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}   
