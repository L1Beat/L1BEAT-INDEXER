import { NextPage } from 'next';
import React from 'react';

interface TransactionDetail {
    txHash: string;
    status: string;
    block: string;
    timestamp: string;
    from: string;
    to: string;
    erc20Transfers: React.ReactNode;
    value: string;
    transactionFee: string;
    gasPrice: string;
    gasLimitUsage: string;
    gasFees: string;
    burntAndSavings: React.ReactNode;
    otherAttributes: React.ReactNode;
}

// Mock data for transaction details
const mockTransactionDetail: TransactionDetail = {
    txHash: '0xb23fecac0eafd90d077076302a419025fc697820187ac2f5bf6b4e4904f88b9',
    status: 'Success',
    block: '22460222',
    timestamp: '8 secs ago (May-11-2025 12:53:47 PM UTC)',
    from: '0xd0B149352E4bd7c956362F39e4a8373eA43812e1',
    to: '0xa0b1ebf52A9307F30509d3b385754c33B7F2E26',
    erc20Transfers: (
        <div className="space-y-1">
            <div>
                From{' '}
                <a href="/address/0xa0b1ebf52A9307F30509d3b385754c33B7F2E26" className="text-blue-600 hover:underline">
                    0xa0b1...F2E26
                </a>{' '}
                To{' '}
                <a href="/address/0x4370F944AA75dd448e35e6Ed6f59CB4Beba634E6" className="text-blue-600 hover:underline">
                    0x4370...634E6
                </a>{' '}
                For 3.151257 USDC
            </div>
        </div>
    ),
    value: '0 ETH ($0.00)',
    transactionFee: '0.000559724533865016 ETH ($1.41)',
    gasPrice: '3.906726603 Gwei (0.000000003906726603 ETH)',
    gasLimitUsage: '288,846 | 143,272 (49.6%)',
    gasFees: 'Base: 3.906726603 Gwei | Max: 3.906726603 Gwei | Max Priority: 3 Gwei',
    burntAndSavings: (
        <div className="space-y-1">
            <div>Burnt: 0.000559724533865016 ETH ($1.41)</div>
            <div>Txn Savings: 0 ETH ($0.00)</div>
        </div>
    ),
    otherAttributes: (
        <div className="space-y-1">
            <div>Txn Type: 2 (EIP-1559)</div>
            <div>Nonce: 7986</div>
            <div>Position In Block: 115</div>
        </div>
    ),
};

interface TxPageProps {
    params: { id: string };
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4 px-6 border-b border-gray-200 last:border-b-0">
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
    </div>
);

const TxPage: NextPage<TxPageProps> = ({ params }) => {
    const tx = mockTransactionDetail;

    return (
        <div className="min-h-screen bg-white p-6 max-w-4xl mx-auto font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Transaction {params.id}</h1>
            </header>
            <div className="bg-white shadow sm:rounded-lg border border-gray-200">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Overview</h3>
                </div>
                <dl>
                    <DetailRow
                        label="Transaction Hash"
                        value={
                            <a href={`/tx/${tx.txHash}`} className="text-blue-600 hover:underline">
                                {tx.txHash}
                            </a>
                        }
                    />
                    <DetailRow
                        label="Status"
                        value={
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {tx.status}
                            </span>
                        }
                    />
                    <DetailRow
                        label="Block"
                        value={
                            <a href={`/block/${tx.block}`} className="text-blue-600 hover:underline">
                                {tx.block}
                            </a>
                        }
                    />
                    <DetailRow label="Timestamp" value={tx.timestamp} />
                    <DetailRow
                        label="From"
                        value={
                            <a href={`/address/${tx.from}`} className="text-blue-600 hover:underline">
                                {tx.from}
                            </a>
                        }
                    />
                    <DetailRow
                        label="To"
                        value={
                            <a href={`/address/${tx.to}`} className="text-blue-600 hover:underline">
                                {tx.to}
                            </a>
                        }
                    />
                    <DetailRow label="ERC-20 Tokens Transferred" value={tx.erc20Transfers} />
                    <DetailRow label="Value" value={tx.value} />
                    <DetailRow label="Transaction Fee" value={tx.transactionFee} />
                    <DetailRow label="Gas Price" value={tx.gasPrice} />
                    <DetailRow label="Gas Limit & Usage" value={tx.gasLimitUsage} />
                    <DetailRow label="Gas Fees" value={tx.gasFees} />
                    <DetailRow label="Burnt & Txn Savings Fees" value={tx.burntAndSavings} />
                    <DetailRow label="Other Attributes" value={tx.otherAttributes} />
                </dl>
            </div>
        </div>
    );
};

export default TxPage; 
