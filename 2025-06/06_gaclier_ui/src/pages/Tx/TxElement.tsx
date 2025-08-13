import { ArrowRightLeft, Clock, Hash, Zap, Fuel, ArrowUp, ArrowDown, Activity, CheckCircle, XCircle, FileText, User, Target, Coins, Image, Layers } from "lucide-react";
import type { GetTransactionResponse } from "@avalanche-sdk/data/models/components";
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

// Format token values with decimals
const formatTokenValue = (value: string, decimals: number = 18): string => {
    const num = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const result = Number(num) / Number(divisor);
    return result.toFixed(6);
}

// Format transaction status
const getStatusBadge = (status: string) => {
    const isSuccess = status === "1";
    return (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${isSuccess
            ? 'bg-green-50 text-green-700 ring-green-700/10'
            : 'bg-red-50 text-red-700 ring-red-700/10'
            }`}>
            {isSuccess ? (
                <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Success
                </>
            ) : (
                <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                </>
            )}
        </span>
    );
}

export default function TxElement({ tx }: { tx: GetTransactionResponse }) {
    const { nativeTransaction } = tx;
    const gasUtilization = (Number(nativeTransaction.gasUsed) / Number(nativeTransaction.gasLimit)) * 100;

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center">
                    <div className="h-12 w-12 flex-shrink-0">
                        <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                            <ArrowRightLeft className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <div className="ml-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Transaction Details
                        </h1>
                        <p className="text-sm text-gray-500 font-mono">
                            <ShortHash hash={nativeTransaction.txHash} />
                        </p>
                    </div>
                    <div className="ml-auto">
                        {getStatusBadge(nativeTransaction.txStatus)}
                    </div>
                </div>
            </div>

            {/* Transaction Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Transaction Information</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Hash className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Transaction Hash</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <ShortHash hash={nativeTransaction.txHash} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Timestamp</span>
                            </div>
                            <div className="text-sm text-gray-900 text-right">
                                <code>{nativeTransaction.blockTimestamp}</code>{" "}
                                (<Ago timestamp={nativeTransaction.blockTimestamp * 1000} format="twitter" /> ago)
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <ArrowUp className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Block Number</span>
                            </div>
                            <div className="text-sm text-gray-900">
                                <a
                                    href={`/block/${nativeTransaction.blockNumber}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    {formatNumber(nativeTransaction.blockNumber)}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Hash className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Block Hash</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <a
                                    href={`/block/${nativeTransaction.blockHash}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    <ShortHash hash={nativeTransaction.blockHash} />
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Activity className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Block Index</span>
                            </div>
                            <div className="text-sm text-gray-900">
                                {nativeTransaction.blockIndex}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Transaction Type</span>
                            <div className="text-sm text-gray-900">
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    Type {nativeTransaction.txType}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Nonce</span>
                            <div className="text-sm text-gray-900">
                                {formatNumber(nativeTransaction.nonce)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transfer Information */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Transfer Details</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <User className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">From</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <a
                                    href={`/address/${nativeTransaction.from.address}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    {nativeTransaction.from.name || nativeTransaction.from.address}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Target className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">To</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                <a
                                    href={`/address/${nativeTransaction.to.address}`}
                                    className="text-blue-600 hover:text-blue-900"
                                >
                                    {nativeTransaction.to.name || nativeTransaction.to.address}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Zap className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Value</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatAvax(nativeTransaction.value)}
                            </div>
                        </div>

                        {nativeTransaction.method && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <FileText className="h-4 w-4 text-gray-400 mr-2" />
                                    <span className="text-sm font-medium text-gray-500">Method</span>
                                </div>
                                <div className="text-sm text-gray-900">
                                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                        {nativeTransaction.method.methodName || nativeTransaction.method.methodHash}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start justify-between">
                            <div className="flex items-center">
                                <FileText className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                                <span className="text-sm font-medium text-gray-500">Input Data</span>
                            </div>
                            <div className="text-sm text-gray-900 font-mono text-right max-w-xs">
                                <div className="break-all">
                                    {nativeTransaction.input}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gas Information */}
            <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Gas Information</h3>
                </div>
                <div className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Fuel className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-500">Gas Used</span>
                            </div>
                            <div className="text-sm text-gray-900">
                                {formatNumber(nativeTransaction.gasUsed)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Gas Limit</span>
                            <div className="text-sm text-gray-900">
                                {formatNumber(nativeTransaction.gasLimit)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Gas Price</span>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatGas(nativeTransaction.gasPrice)}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500">Base Fee</span>
                            <div className="text-sm text-gray-900 font-mono">
                                {formatGas(nativeTransaction.baseFeePerGas)}
                            </div>
                        </div>

                        {nativeTransaction.maxFeePerGas && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">Max Fee</span>
                                <div className="text-sm text-gray-900 font-mono">
                                    {formatGas(nativeTransaction.maxFeePerGas)}
                                </div>
                            </div>
                        )}

                        {nativeTransaction.maxPriorityFeePerGas && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">Max Priority Fee</span>
                                <div className="text-sm text-gray-900 font-mono">
                                    {formatGas(nativeTransaction.maxPriorityFeePerGas)}
                                </div>
                            </div>
                        )}

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
                    </div>

                    {/* Gas Utilization Bar */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-500">
                                {formatNumber(nativeTransaction.gasUsed)} / {formatNumber(nativeTransaction.gasLimit)}
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

            {/* ERC-20 Transfers */}
            {tx.erc20Transfers && tx.erc20Transfers.length > 0 && (
                <div className="mt-6 bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center">
                            <Coins className="h-5 w-5 text-blue-600 mr-2" />
                            <h3 className="text-lg font-semibold text-gray-900">
                                ERC-20 Token Transfers ({tx.erc20Transfers.length})
                            </h3>
                        </div>
                    </div>
                    <div className="px-6 py-4">
                        <div className="space-y-4">
                            {tx.erc20Transfers.map((transfer, index) => (
                                <div key={`${transfer.logIndex}-${index}`} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Token</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc20Token.name || transfer.erc20Token.symbol || 'Unknown Token'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Address</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.erc20Token.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <ShortHash hash={transfer.erc20Token.address} />
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Value</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {formatTokenValue(transfer.value, transfer.erc20Token.decimals || 18)} {transfer.erc20Token.symbol || 'TOKENS'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">From</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.from.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.from.name || <ShortHash hash={transfer.from.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">To</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.to.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.to.name || <ShortHash hash={transfer.to.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Log Index</span>
                                                <div className="text-sm text-gray-900">
                                                    {transfer.logIndex}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ERC-721 Transfers */}
            {tx.erc721Transfers && tx.erc721Transfers.length > 0 && (
                <div className="mt-6 bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center">
                            <Image className="h-5 w-5 text-purple-600 mr-2" />
                            <h3 className="text-lg font-semibold text-gray-900">
                                ERC-721 NFT Transfers ({tx.erc721Transfers.length})
                            </h3>
                        </div>
                    </div>
                    <div className="px-6 py-4">
                        <div className="space-y-4">
                            {tx.erc721Transfers.map((transfer, index) => (
                                <div key={`${transfer.logIndex}-${index}`} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Collection</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc721Token.name || transfer.erc721Token.symbol || 'Unknown NFT'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Contract</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.erc721Token.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <ShortHash hash={transfer.erc721Token.address} />
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Token ID</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc721Token.tokenId || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">From</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.from.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.from.name || <ShortHash hash={transfer.from.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">To</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.to.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.to.name || <ShortHash hash={transfer.to.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Log Index</span>
                                                <div className="text-sm text-gray-900">
                                                    {transfer.logIndex}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ERC-1155 Transfers */}
            {tx.erc1155Transfers && tx.erc1155Transfers.length > 0 && (
                <div className="mt-6 bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center">
                            <Layers className="h-5 w-5 text-indigo-600 mr-2" />
                            <h3 className="text-lg font-semibold text-gray-900">
                                ERC-1155 Multi-Token Transfers ({tx.erc1155Transfers.length})
                            </h3>
                        </div>
                    </div>
                    <div className="px-6 py-4">
                        <div className="space-y-4">
                            {tx.erc1155Transfers.map((transfer, index) => (
                                <div key={`${transfer.logIndex}-${index}`} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Collection</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc1155Token.address}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Contract</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.erc1155Token.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <ShortHash hash={transfer.erc1155Token.address} />
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Token ID</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc1155Token.tokenId || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Value</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    {transfer.erc1155Token.metadata.decimals && formatTokenValue(transfer.value, transfer.erc1155Token.metadata.decimals)}
                                                    {!transfer.erc1155Token.metadata.decimals && `Raw value: ${transfer.value}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">From</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.from.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.from.name || <ShortHash hash={transfer.from.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">To</span>
                                                <div className="text-sm text-gray-900 font-mono">
                                                    <a
                                                        href={`/address/${transfer.to.address}`}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        {transfer.to.name || <ShortHash hash={transfer.to.address} />}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-500">Log Index</span>
                                                <div className="text-sm text-gray-900">
                                                    {transfer.logIndex}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
