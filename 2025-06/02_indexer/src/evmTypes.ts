import { z } from "@hono/zod-openapi"

export const LogSchema = z.object({
    address: z.string(),
    topics: z.string().array(),
    data: z.string(),
    blockNumber: z.string(),
    transactionHash: z.string(),
    transactionIndex: z.string(),
    blockHash: z.string(),
    logIndex: z.string(),
    removed: z.boolean(),
})

export type Log = z.infer<typeof LogSchema>

export const ReceiptSchema = z.object({
    blockHash: z.string(),
    blockNumber: z.string(),
    contractAddress: z.string().nullable(),
    cumulativeGasUsed: z.string(),
    effectiveGasPrice: z.string(),
    from: z.string(),
    gasUsed: z.string(),
    logs: LogSchema.array(),
    logsBloom: z.string(),
    status: z.string(),
    to: z.string(),
    transactionHash: z.string(),
    transactionIndex: z.string(),
    type: z.string(),
})

export type Receipt = z.infer<typeof ReceiptSchema>

export const TransactionSchema = z.object({
    hash: z.string(),
    blockHash: z.string(),
    blockNumber: z.string(),
    transactionIndex: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    value: z.string(),
    gas: z.string(),
    gasPrice: z.string(),
    input: z.string(),
    nonce: z.string(),
    type: z.string(),
    chainId: z.string(),
    v: z.string(),
    r: z.string(),
    s: z.string(),
    maxFeePerGas: z.string().optional(),
    maxPriorityFeePerGas: z.string().optional(),
    accessList: z.any().array().optional(),
    yParity: z.string().optional(),
})

export type Transaction = z.infer<typeof TransactionSchema>

export const BlockSchema = z.object({
    hash: z.string(),
    number: z.string(),
    parentHash: z.string(),
    timestamp: z.string(),
    gasLimit: z.string(),
    gasUsed: z.string(),
    baseFeePerGas: z.string(),
    miner: z.string(),
    difficulty: z.string(),
    totalDifficulty: z.string(),
    size: z.string(),
    stateRoot: z.string(),
    transactionsRoot: z.string(),
    receiptsRoot: z.string(),
    logsBloom: z.string(),
    extraData: z.string(),
    mixHash: z.string(),
    nonce: z.string(),
    sha3Uncles: z.string(),
    uncles: z.string().array(),
    transactions: TransactionSchema.array(),
    blobGasUsed: z.string().optional(),
    excessBlobGas: z.string().optional(),
    parentBeaconBlockRoot: z.string().optional(),
    blockGasCost: z.string().optional(),
})

export type Block = z.infer<typeof BlockSchema>
