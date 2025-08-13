import { NextPage } from 'next';

// Data interface for Block Details
interface BlockDetail {
    blockHeight: string;
    timestamp: string;
    transactions: string; // Could be a link or just count
    fees: string;
    size: string;
    gasUsed: string;
    gasLimit: string;
    baseFeePerGas: string;
    hash: string;
    parentHash: string; // Link
    stateRoot: string;
}

// Mock data for a single block
const mockBlockDetailData: BlockDetail = {
    blockHeight: "61838564",
    timestamp: "1m ago (May 11, 2025, 9:46:02 PM GMT+9)",
    transactions: "4 transactions",
    fees: "0.009819030399371836 AVAX",
    size: "4.753 kilobytes",
    gasUsed: "2,129,993",
    gasLimit: "16,000,000",
    baseFeePerGas: "1.398031861e-9 AVAX (1.398031861 nAVAX)",
    hash: "0xbc8972dd35dc8a3320b44dc8c95dd55cc269f469e67f9359ac8cf2ee36419a70",
    parentHash: "0x64b76547c2eee6a5e28629be23d31355d63121381d910c9334115bdf5df854bc",
    stateRoot: "0xad795badb10d5a749aa4a90fcdce27e245cf4d4b0dd43e8e494cde198ce12bfe",
};

interface BlockPageProps {
    params: {
        id: string; // block number or hash
    };
}

// Helper function to create a consistent row style
const DetailRow: React.FC<{ label: string; value: string | React.ReactNode; isLink?: boolean }> = ({ label, value, isLink }) => (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 px-6 border-b border-gray-200 last:border-b-0">
        <dt className="text-sm font-medium text-gray-500 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            {label}
        </dt>
        <dd className={`mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 ${isLink ? 'text-blue-600 hover:underline' : ''}`}>
            {value}
        </dd>
    </div>
);


const BlockPage: NextPage<BlockPageProps> = ({ params }) => {
    // In a real app, you would fetch data based on params.id
    const blockData = mockBlockDetailData; // Using mock data for now

    return (
        <div className="min-h-screen bg-white p-6 max-w-4xl mx-auto font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Block #{blockData.blockHeight}
                </h1>
            </header>

            <div className="bg-white shadow sm:rounded-lg border border-gray-200">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Overview</h3>
                </div>
                <dl>
                    <DetailRow label="Block Height" value={
                        <div className="flex items-center">
                            <button className="text-gray-500 hover:text-gray-700 mr-2 p-1 rounded-md hover:bg-gray-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <span className="font-medium">{blockData.blockHeight}</span>
                            <button className="text-gray-500 hover:text-gray-700 ml-2 p-1 rounded-md hover:bg-gray-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </div>
                    } />
                    <DetailRow label="Timestamp" value={blockData.timestamp} />
                    <DetailRow label="Transactions" value={<a href={`/block/${params.id}/transactions`} className="text-blue-600 hover:underline">{blockData.transactions}</a>} />
                    <DetailRow label="Fees" value={blockData.fees} />
                    <DetailRow label="Size" value={blockData.size} />
                    <DetailRow label="Gas Used" value={blockData.gasUsed} />
                    <DetailRow label="Gas Limit" value={blockData.gasLimit} />
                    <DetailRow label="Base Fee Per Gas" value={blockData.baseFeePerGas} />
                    <DetailRow label="Hash" value={blockData.hash} />
                    <DetailRow label="Parent Hash" value={<a href={`/block/${blockData.parentHash}`} className="text-blue-600 hover:underline">{blockData.parentHash}</a>} isLink />
                    <DetailRow label="State Root" value={blockData.stateRoot} />
                </dl>
            </div>
        </div>
    );
};

export default BlockPage;
