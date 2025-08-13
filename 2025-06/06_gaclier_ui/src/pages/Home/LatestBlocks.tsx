import { Box } from "lucide-react"
import { Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import Ago from "../../components/Ago"
import type { EvmBlock } from "@avalanche-sdk/data/models/components";
import ShortHash from "../../components/ShortHash";


export default function BlockchainBlocks({ blocks = [] }: { blocks: EvmBlock[] }) {
    const [newBlocks, setNewBlocks] = useState<Set<string>>(new Set());
    const prevBlocksRef = useRef<EvmBlock[]>([]);

    useEffect(() => {
        const prevBlockNumbers = new Set(prevBlocksRef.current.map(b => b.blockNumber.toString()));
        const currentBlockNumbers = new Set(blocks.map(b => b.blockNumber.toString()));

        // Find blocks that are in current but not in previous
        const newBlockNumbers = new Set(
            Array.from(currentBlockNumbers).filter(num => !prevBlockNumbers.has(num))
        );

        if (newBlockNumbers.size > 0) {
            setNewBlocks(newBlockNumbers);
            // Remove animation after 2 seconds
            setTimeout(() => setNewBlocks(new Set()), 2000);
        }

        prevBlocksRef.current = blocks;
    }, [blocks]);

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
                        <h1 className="text-base font-semibold leading-6 text-gray-900">Latest Blocks</h1>
                    </div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                        <Link
                            to="blocks"
                            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            View all blocks
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
                                            Block
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            Age
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            Txs
                                        </th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                            Hash
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {blocks.map((block) => {
                                        const isNew = newBlocks.has(block.blockNumber.toString());
                                        return (
                                            <tr
                                                key={block.blockNumber}
                                                className={`hover:bg-gray-50 transition-all duration-300 ${isNew ? 'fade-in-new' : ''
                                                    }`}
                                            >
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 flex-shrink-0">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                                <Box className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="font-medium text-gray-900">
                                                                <a
                                                                    href={`/block/${block.blockNumber}`}
                                                                    className="text-blue-600 hover:text-blue-900"
                                                                >
                                                                    {block.blockNumber.toLocaleString()}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <Ago timestamp={block.blockTimestamp * 1000} />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                                        {block.txCount}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <code className="font-mono">
                                                        <a
                                                            href={`/block/${block.blockHash}`}
                                                            className="text-blue-600 hover:text-blue-900"
                                                        >
                                                            <ShortHash hash={block.blockHash} />
                                                        </a>
                                                    </code>
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
