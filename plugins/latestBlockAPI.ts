import type { ApiPlugin } from "frostbyte-sdk";

const module: ApiPlugin = {
    name: "latest_block",
    requiredIndexers: [], // Uses blocksDb directly, no custom indexers needed

    registerRoutes: (app, dbCtx) => {
        // Get available chains from the database context
        const getAvailableChains = () => {
            const configs = dbCtx.getAllChainConfigs();
            return {
                chainIds: configs.map(config => config.evmChainId.toString()),
                chainNames: configs.map(config => config.chainName),
                chainDescriptions: configs.map(config => config.evmChainId.toString()).join(', '),
                chainOptionsWithNames: configs.map(config => config.evmChainId.toString())
            };
        };

        const { chainIds, chainDescriptions, chainOptionsWithNames } = getAvailableChains();
        // Get complete latest block data
        app.get('/api/:evmChainId/blocks/latest', {
            schema: {
                description: 'Get the latest block with complete data including transactions and metadata',
                tags: ['Blocks'],
                summary: 'Latest Block Data',
                params: {
                    type: 'object',
                    properties: {
                        evmChainId: { 
                            type: 'string',
                            description: 'Select chain from the dropdown. The API will use the chain ID (numbers before parentheses)',
                            enum: chainOptionsWithNames
                        }
                    },
                    required: ['evmChainId'],
                    additionalProperties: false
                },
                querystring: {
                    type: 'object',
                    properties: {
                        includeTransactionDetails: { 
                            type: 'boolean',
                            description: 'Include detailed transaction data in response',
                            default: true
                        },
                        includeBlockMetadata: { 
                            type: 'boolean',
                            description: 'Include block analysis metadata (timing, address counts, etc.)',
                            default: true
                        },
                        includeGasAnalysis: { 
                            type: 'boolean',
                            description: 'Include gas usage analysis and transaction receipts',
                            default: false
                        }
                    },
                    additionalProperties: false
                },
                response: {
                    200: {
                        description: 'Latest block data with transactions and metadata',
                        type: 'object',
                        properties: {
                            chainInfo: {
                                type: 'object',
                                properties: {
                                    chainId: { type: 'integer', description: 'EVM Chain ID' },
                                    chainName: { type: 'string', description: 'Human readable chain name' },
                                    blockchainId: { type: 'string', description: 'Avalanche blockchain ID' },
                                    rpcUrl: { type: 'string', description: 'RPC endpoint URL' }
                                }
                            },
                            syncStatus: {
                                type: 'object',
                                properties: {
                                    indexedBlockNumber: { type: 'integer', description: 'Latest block indexed by this service' },
                                    blockchainLatestNumber: { type: 'integer', description: 'Latest block on the blockchain' },
                                    syncLag: { type: 'integer', description: 'Number of blocks behind blockchain' },
                                    isFullySynced: { type: 'boolean', description: 'Whether indexer is caught up' }
                                }
                            },
                            block: {
                                type: 'object',
                                properties: {
                                    number: { type: 'integer', description: 'Block number' },
                                    hash: { type: 'string', description: 'Block hash' },
                                    parentHash: { type: 'string', description: 'Parent block hash' },
                                    timestamp: { type: 'integer', description: 'Block timestamp (Unix seconds)' },
                                    timestampISO: { type: 'string', description: 'Block timestamp in ISO format' },
                                    gasLimit: { type: 'string', description: 'Block gas limit (hex)' },
                                    gasUsed: { type: 'string', description: 'Gas used by all transactions (hex)' },
                                    gasUtilization: { type: 'string', description: 'Gas utilization percentage' },
                                    size: { type: 'string', description: 'Block size in bytes (hex)' },
                                    transactionCount: { type: 'integer', description: 'Number of transactions in block' },
                                    miner: { type: 'string', description: 'Block producer/validator address' },
                                    difficulty: { type: 'string', description: 'Block difficulty (hex)' },
                                    totalDifficulty: { type: 'string', description: 'Total chain difficulty (hex)' },
                                    baseFeePerGas: { type: 'string', description: 'EIP-1559 base fee (hex)' }
                                }
                            },
                            transactions: {
                                type: 'array',
                                description: 'Array of transaction objects (when includeTransactionDetails=true)',
                                items: {
                                    type: 'object',
                                    properties: {
                                        hash: { type: 'string', description: 'Transaction hash' },
                                        from: { type: 'string', description: 'Sender address' },
                                        to: { type: 'string', description: 'Recipient address (null for contract creation)' },
                                        value: { type: 'string', description: 'Value transferred in wei (hex)' },
                                        valueEth: { type: 'string', description: 'Value in ETH/AVAX (decimal)' },
                                        gas: { type: 'string', description: 'Gas limit (hex)' },
                                        gasPrice: { type: 'string', description: 'Gas price (hex)' },
                                        input: { type: 'string', description: 'Transaction input data' },
                                        nonce: { type: 'string', description: 'Sender nonce (hex)' },
                                        type: { type: 'string', description: 'Transaction type (0x0=legacy, 0x2=EIP-1559)' },
                                        isContractCreation: { type: 'boolean', description: 'Whether this creates a contract' },
                                        isValueTransfer: { type: 'boolean', description: 'Whether this transfers value' },
                                        hasData: { type: 'boolean', description: 'Whether transaction includes data' }
                                    }
                                }
                            },
                            metadata: {
                                type: 'object',
                                description: 'Block analysis metadata (when includeBlockMetadata=true)',
                                properties: {
                                    blockTime: { type: 'integer', description: 'Seconds since previous block' },
                                    averageTransactionValue: { type: 'number', description: 'Average transaction value in ETH/AVAX' },
                                    uniqueAddresses: {
                                        type: 'object',
                                        properties: {
                                            senders: { type: 'integer', description: 'Number of unique sender addresses' },
                                            recipients: { type: 'integer', description: 'Number of unique recipient addresses' }
                                        }
                                    },
                                    transactionTypes: {
                                        type: 'object',
                                        properties: {
                                            legacy: { type: 'integer', description: 'Number of legacy transactions' },
                                            eip1559: { type: 'integer', description: 'Number of EIP-1559 transactions' },
                                            other: { type: 'integer', description: 'Number of other transaction types' }
                                        }
                                    }
                                }
                            },
                            gasAnalysis: {
                                type: 'object',
                                description: 'Gas usage analysis (when includeGasAnalysis=true)',
                                properties: {
                                    totalGasUsed: { type: 'integer', description: 'Total gas used by all transactions' },
                                    averageGasPerTransaction: { type: 'integer', description: 'Average gas per transaction' },
                                    gasEfficiency: { type: 'string', description: 'Gas efficiency percentage' },
                                    successfulTransactions: { type: 'integer', description: 'Number of successful transactions' },
                                    failedTransactions: { type: 'integer', description: 'Number of failed transactions' }
                                }
                            }
                        }
                    },
                    404: {
                        description: 'Chain not found or latest block not available',
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            chainId: { type: 'integer' }
                        }
                    },
                    500: {
                        description: 'Internal server error',
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const { evmChainId: rawChainId } = request.params as { evmChainId: string };
            // Extract chain ID from format "123456 (ChainName)" -> "123456"
            const evmChainId = rawChainId.includes('(') ? rawChainId.split(' (')[0] : rawChainId;
            const query = request.query as { 
                includeTransactionDetails?: boolean; 
                includeBlockMetadata?: boolean; 
                includeGasAnalysis?: boolean; 
            };
            const { 
                includeTransactionDetails = true, 
                includeBlockMetadata = true, 
                includeGasAnalysis = false 
            } = query;
            
            try {
                const chainId = parseInt(evmChainId);
                const blocksDbHelper = dbCtx.getBlocksDbHelper(chainId);
                const chainConfig = dbCtx.getChainConfig(chainId);
                
                if (!chainConfig) {
                    return reply.code(404).send({ 
                        error: 'Chain not found',
                        chainId 
                    });
                }
                
                // Get latest block number
                const latestBlockNum = blocksDbHelper.getLastStoredBlockNumber();
                const blockchainLatestNum = blocksDbHelper.getBlockchainLatestBlockNum();
                
                // Get complete block with all transactions
                const block = blocksDbHelper.slow_getBlockWithTransactions(latestBlockNum);
                
                if (!block) {
                    return reply.code(404).send({ 
                        error: 'Latest block not found',
                        blockNumber: latestBlockNum 
                    });
                }
                
                // Build response with full block data
                const response: any = {
                    chainInfo: {
                        chainId,
                        chainName: chainConfig.chainName,
                        blockchainId: chainConfig.blockchainId,
                        rpcUrl: chainConfig.rpcConfig.rpcUrl
                    },
                    syncStatus: {
                        indexedBlockNumber: latestBlockNum,
                        blockchainLatestNumber: blockchainLatestNum,
                        syncLag: blockchainLatestNum - latestBlockNum,
                        isFullySynced: (blockchainLatestNum - latestBlockNum) <= 1
                    },
                    block: {
                        // Core block identifiers
                        number: parseInt(block.number),
                        hash: block.hash,
                        parentHash: block.parentHash,
                        
                        // Timing
                        timestamp: parseInt(block.timestamp),
                        timestampISO: new Date(parseInt(block.timestamp) * 1000).toISOString(),
                        
                        // Gas and size
                        gasLimit: block.gasLimit,
                        gasUsed: block.gasUsed,
                        gasUtilization: ((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100).toFixed(2) + '%',
                        size: block.size,
                        
                        // Transaction summary
                        transactionCount: block.transactions.length,
                        
                        // Mining/validation info
                        miner: block.miner,
                        difficulty: block.difficulty,
                        totalDifficulty: block.totalDifficulty,
                        
                        // Merkle roots
                        stateRoot: block.stateRoot,
                        transactionsRoot: block.transactionsRoot,
                        receiptsRoot: block.receiptsRoot,
                        
                        // Additional data
                        extraData: block.extraData,
                        logsBloom: block.logsBloom,
                        nonce: block.nonce,
                        mixHash: block.mixHash,
                        sha3Uncles: block.sha3Uncles,
                        uncles: block.uncles
                    }
                };
                
                // Add EIP-1559 fields if present
                if (block.baseFeePerGas) {
                    response.block.baseFeePerGas = block.baseFeePerGas;
                }
                
                // Add blob fields if present (EIP-4844)
                if (block.blobGasUsed) {
                    response.block.blobGasUsed = block.blobGasUsed;
                    response.block.excessBlobGas = block.excessBlobGas;
                }
                
                // Add Avalanche-specific fields if present
                if (block.blockGasCost) {
                    response.block.blockGasCost = block.blockGasCost;
                }
                if (block.blockExtraData) {
                    response.block.blockExtraData = block.blockExtraData;
                }
                if (block.extDataHash) {
                    response.block.extDataHash = block.extDataHash;
                }
                
                // Include detailed transaction data if requested
                if (includeTransactionDetails) {
                    response.transactions = block.transactions.map((tx, index) => ({
                        // Transaction identifiers
                        hash: tx.hash,
                        blockHash: tx.blockHash,
                        blockNumber: parseInt(tx.blockNumber),
                        transactionIndex: parseInt(tx.transactionIndex),
                        
                        // Addresses and value
                        from: tx.from,
                        to: tx.to,
                        value: tx.value,
                        valueEth: (parseInt(tx.value) / 1e18).toFixed(6),
                        
                        // Gas
                        gas: tx.gas,
                        gasPrice: tx.gasPrice,
                        
                        // Transaction data
                        input: tx.input,
                        inputSize: tx.input.length,
                        nonce: tx.nonce,
                        type: tx.type,
                        chainId: tx.chainId,
                        
                        // Signature
                        v: tx.v,
                        r: tx.r,
                        s: tx.s,
                        
                        // EIP-1559 fields if present
                        ...(tx.maxFeePerGas && { maxFeePerGas: tx.maxFeePerGas }),
                        ...(tx.maxPriorityFeePerGas && { maxPriorityFeePerGas: tx.maxPriorityFeePerGas }),
                        ...(tx.accessList && { accessList: tx.accessList }),
                        ...(tx.yParity && { yParity: tx.yParity }),
                        
                        // Derived fields
                        isContractCreation: !tx.to,
                        isValueTransfer: parseInt(tx.value) > 0,
                        hasData: tx.input !== '0x'
                    }));
                    
                    // Add transaction receipts for gas analysis
                    if (includeGasAnalysis) {
                        const receipts = await Promise.all(
                            block.transactions.map(async (tx) => {
                                const receipt = blocksDbHelper.getTxReceipt(tx.hash);
                                return receipt ? {
                                    transactionHash: tx.hash,
                                    gasUsed: receipt.gasUsed,
                                    effectiveGasPrice: receipt.effectiveGasPrice,
                                    status: receipt.status,
                                    cumulativeGasUsed: receipt.cumulativeGasUsed,
                                    logsCount: receipt.logs.length,
                                    contractAddress: receipt.contractAddress
                                } : null;
                            })
                        );
                        
                        response.transactionReceipts = receipts.filter(r => r !== null);
                        
                        // Gas analysis summary
                        const totalGasUsed = response.transactionReceipts.reduce(
                            (sum: number, r: any) => sum + parseInt(r.gasUsed), 0
                        );
                        const avgGasPerTx = totalGasUsed / response.transactionReceipts.length;
                        
                        response.gasAnalysis = {
                            totalGasUsed,
                            averageGasPerTransaction: Math.round(avgGasPerTx),
                            gasEfficiency: ((totalGasUsed / parseInt(block.gasLimit)) * 100).toFixed(2) + '%',
                            successfulTransactions: response.transactionReceipts.filter((r: any) => r.status === '1').length,
                            failedTransactions: response.transactionReceipts.filter((r: any) => r.status === '0').length
                        };
                    }
                }
                
                // Add block metadata if requested
                if (includeBlockMetadata) {
                    // Calculate block time (time since previous block)
                    let blockTime: number | null = null;
                    if (latestBlockNum > 1) {
                        const prevBlock = blocksDbHelper.slow_getBlockWithTransactions(latestBlockNum - 1);
                        if (prevBlock) {
                            blockTime = parseInt(block.timestamp) - parseInt(prevBlock.timestamp);
                        }
                    }
                    
                    response.metadata = {
                        blockTime: blockTime,
                        averageTransactionValue: block.transactions.length > 0 
                            ? (block.transactions.reduce((sum, tx) => sum + parseInt(tx.value), 0) / block.transactions.length) / 1e18 
                            : 0,
                        uniqueAddresses: {
                            senders: new Set(block.transactions.map(tx => tx.from)).size,
                            recipients: new Set(block.transactions.filter(tx => tx.to).map(tx => tx.to)).size
                        },
                        transactionTypes: {
                            legacy: block.transactions.filter(tx => tx.type === '0x0').length,
                            eip1559: block.transactions.filter(tx => tx.type === '0x2').length,
                            other: block.transactions.filter(tx => !['0x0', '0x2'].includes(tx.type)).length
                        }
                    };
                }
                
                return reply.send(response);
                
            } catch (error) {
                console.error('Error fetching latest block:', error);
                return reply.code(500).send({ 
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Get multiple latest blocks
        app.get('/api/:evmChainId/blocks/latest/:count', {
            schema: {
                description: 'Get summary information for the latest N blocks',
                tags: ['Blocks'],
                summary: 'Multiple Latest Blocks Summary',
                params: {
                    type: 'object',
                    properties: {
                        evmChainId: { 
                            type: 'string',
                            description: 'Select chain from the dropdown. The API will use the chain ID (numbers before parentheses)',
                            enum: chainOptionsWithNames
                        },
                        count: { 
                            type: 'integer', 
                            minimum: 1, 
                            maximum: 10,
                            description: 'Number of latest blocks to retrieve (1-10)'
                        }
                    },
                    required: ['evmChainId', 'count'],
                    additionalProperties: false
                },
                response: {
                    200: {
                        description: 'Summary data for the latest N blocks',
                        type: 'object',
                        properties: {
                            chainId: { type: 'integer', description: 'EVM Chain ID' },
                            latestBlockNumber: { type: 'integer', description: 'Most recent block number indexed' },
                            blocks: {
                                type: 'array',
                                description: 'Array of block summaries (ordered newest to oldest)',
                                items: {
                                    type: 'object',
                                    properties: {
                                        number: { type: 'integer', description: 'Block number' },
                                        hash: { type: 'string', description: 'Block hash' },
                                        timestamp: { type: 'integer', description: 'Block timestamp (Unix seconds)' },
                                        timestampISO: { type: 'string', description: 'Block timestamp in ISO format' },
                                        transactionCount: { type: 'integer', description: 'Number of transactions in block' },
                                        gasUsed: { type: 'string', description: 'Gas used by all transactions (hex)' },
                                        gasLimit: { type: 'string', description: 'Block gas limit (hex)' },
                                        gasUtilization: { type: 'string', description: 'Gas utilization percentage' },
                                        miner: { type: 'string', description: 'Block producer/validator address' },
                                        size: { type: 'string', description: 'Block size in bytes (hex)' }
                                    }
                                }
                            }
                        }
                    },
                    404: {
                        description: 'Chain not found',
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            chainId: { type: 'integer' }
                        }
                    },
                    500: {
                        description: 'Internal server error',
                        type: 'object',
                        properties: {
                            error: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
            }
        }, async (request, reply) => {
            const { evmChainId: rawChainId, count } = request.params as { evmChainId: string; count: string };
            // Extract chain ID from format "123456 (ChainName)" -> "123456"
            const chainIdStr = rawChainId.includes('(') ? rawChainId.split(' (')[0] : rawChainId;
            const evmChainId = chainIdStr;
            
            try {
                const chainId = parseInt(evmChainId);
                const blocksDbHelper = dbCtx.getBlocksDbHelper(chainId);
                const latestBlockNum = blocksDbHelper.getLastStoredBlockNumber();
                
                const blocks: any[] = [];
                const countNum = parseInt(count);
                for (let i = 0; i < countNum; i++) {
                    const blockNum = latestBlockNum - i;
                    if (blockNum >= 0) {
                        const block = blocksDbHelper.slow_getBlockWithTransactions(blockNum);
                        if (block) {
                            blocks.push({
                                number: parseInt(block.number),
                                hash: block.hash,
                                timestamp: parseInt(block.timestamp),
                                timestampISO: new Date(parseInt(block.timestamp) * 1000).toISOString(),
                                transactionCount: block.transactions.length,
                                gasUsed: block.gasUsed,
                                gasLimit: block.gasLimit,
                                gasUtilization: ((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100).toFixed(2) + '%',
                                miner: block.miner,
                                size: block.size
                            });
                        }
                    }
                }
                
                return reply.send({
                    chainId,
                    latestBlockNumber: latestBlockNum,
                    blocks
                });
                
            } catch (error) {
                console.error('Error fetching latest blocks:', error);
                return reply.code(500).send({ 
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
};

export default module;
