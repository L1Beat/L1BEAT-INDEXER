import { ArrowRightLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import Ago from "../../components/Ago"
import type { NativeTransaction } from "@avalanche-sdk/data/models/components";
import ShortHash from "../../components/ShortHash";

// Format value with proper decimals (assuming 18 decimals for AVAX)
const formatValue = (value: string): string => {
    const numValue = BigInt(value);
    const divisor = BigInt(10 ** 18);
    const result = Number(numValue) / Number(divisor);
    return result.toFixed(4);
}

export default function LatestTransactions({ transactions = [] }: { transactions: NativeTransaction[] }) {
    const [newTransactions, setNewTransactions] = useState<Set<string>>(new Set());
    const prevTransactionsRef = useRef<NativeTransaction[]>([]);

    useEffect(() => {
        const prevTxHashes = new Set(prevTransactionsRef.current.map(tx => tx.txHash));
        const currentTxHashes = new Set(transactions.map(tx => tx.txHash));

        // Find transactions that are in current but not in previous
        const newTxHashes = new Set(
            Array.from(currentTxHashes).filter(hash => !prevTxHashes.has(hash))
        );

        if (newTxHashes.size > 0) {
            setNewTransactions(newTxHashes);
            // Remove animation after 2 seconds
            setTimeout(() => setNewTransactions(new Set()), 2000);
        }

        prevTransactionsRef.current = transactions;
    }, [transactions]);

    return (
        <>
            <style>
                {`
                @keyframes fadeInScale {
                    0% { opacity: 0; transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .fade-in-new {
                    animation: fadeInScale 1.2s ease-out;
                }
                `}
            </style>
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                        <h1 className="text-base font-semibold leading-6 text-gray-900">Latest Transactions</h1>
                    </div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                        <Link
                            to="transactions"
                            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            View all transactions
                        </Link>
                    </div>
                </div>
                <div className="mt-8 flow-root">
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead>
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                                            Transaction
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            Age
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            From → To
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            Value
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {transactions.map((tx) => {
                                        const isNew = newTransactions.has(tx.txHash);
                                        return (
                                            <tr
                                                key={tx.txHash}
                                                className={`hover:bg-gray-50 transition-all duration-300 ${isNew ? 'fade-in-new' : ''
                                                    }`}
                                            >
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 flex-shrink-0">
                                                            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                                <ArrowRightLeft className="h-4 w-4 text-green-600" />
                                                            </div>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="font-medium text-gray-900">
                                                                <code className="font-mono">
                                                                    <a
                                                                        href={`/tx/${tx.txHash}`}
                                                                        className="text-blue-600 hover:text-blue-900"
                                                                    >
                                                                        <ShortHash hash={tx.txHash} />
                                                                    </a>
                                                                </code>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <Ago timestamp={tx.blockTimestamp * 1000} />
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500">
                                                    <div className="flex items-center space-x-2">
                                                        <code className="font-mono text-xs">
                                                            <a
                                                                href={`/address/${tx.from}`}
                                                                className="text-blue-600 hover:text-blue-900"
                                                            >
                                                                {tx.from.name || <ShortHash hash={tx.from.address} />}
                                                            </a>
                                                        </code>
                                                        <ArrowRightLeft className="h-3 w-3 text-gray-400" />
                                                        <code className="font-mono text-xs">
                                                            <a
                                                                href={`/address/${tx.to.address}`}
                                                                className="text-blue-600 hover:text-blue-900"
                                                            >
                                                                {tx.to.name || <ShortHash hash={tx.to.address} />}
                                                            </a>
                                                        </code>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <span className="font-mono">
                                                        {formatValue(tx.value)} AVAX
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

