import { OpenAPIHono, z, createRoute } from "@hono/zod-openapi"
import { IndexContext, Indexer, IndexerFactory } from '../types'
import { StoredBlock } from '../types'
import { getStoredBlock } from './block'
import { getTxReceipt } from './tx'
import { getLastProcessedBlock } from '../system/config'
import { utils } from "@avalabs/avalanchejs"

// JSON-RPC types
interface JsonRpcRequest {
    jsonrpc: "2.0"
    id: number | string | null
    method: string
    params: any[]
}

interface JsonRpcResponse {
    jsonrpc: "2.0"
    id: number | string | null
    result?: any
    error?: {
        code: number
        message: string
        data?: any
    }
}

// RPC error codes
const RPC_ERRORS = {
    PARSE_ERROR: { code: -32700, message: "Parse error" },
    INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
    METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
    INVALID_PARAMS: { code: -32602, message: "Invalid params" },
    INTERNAL_ERROR: { code: -32603, message: "Internal error" },
}

class RpcIndexer extends Indexer {
    private context: IndexContext

    constructor(context: IndexContext, isWriter: boolean = false) {
        super(context, isWriter)
        this.context = context
    }

    protected _initialize = () => {
        // No initialization needed for RPC proxy
    }

    protected _handleBlock = (block: StoredBlock) => {
        // RPC proxy doesn't process blocks
    }

    private createErrorResponse(id: number | string | null, error: { code: number; message: string; data?: any }): JsonRpcResponse {
        return {
            jsonrpc: "2.0",
            id,
            error
        }
    }

    private async handleRpcMethod(method: string, params: any[]): Promise<any> {
        switch (method) {
            case 'eth_blockNumber':
                return this.handleBlockNumber()

            case 'eth_chainId':
                return this.handleChainId()

            case 'eth_getBlockByNumber':
                return this.handleGetBlockByNumber(params)

            case 'eth_getTransactionReceipt':
                return this.handleGetTransactionReceipt(params)

            case 'eth_call':
                return this.handleEthCall(params)

            default:
                throw { ...RPC_ERRORS.METHOD_NOT_FOUND, data: `Method ${method} not found` }
        }
    }

    private async handleBlockNumber(): Promise<string> {
        const blockNumber = getLastProcessedBlock(this.db)
        return `0x${blockNumber.toString(16)}`
    }

    private async handleChainId(): Promise<string> {
        if (!process.env.EVM_CHAIN_ID) {
            throw { ...RPC_ERRORS.INTERNAL_ERROR, data: "EVM_CHAIN_ID is not set" }
        }
        const evmChainId = parseInt(process.env.EVM_CHAIN_ID)
        return `0x${evmChainId.toString(16)}`
    }

    private async handleGetBlockByNumber(params: any[]): Promise<any> {
        if (params.length < 2) {
            throw { ...RPC_ERRORS.INVALID_PARAMS, data: "Missing parameters" }
        }

        const blockNumberHex = params[0]
        const includeTransactions = params[1]

        // We only support includeTransactions === true
        if (includeTransactions !== true) {
            throw { ...RPC_ERRORS.INVALID_PARAMS, data: "Only includeTransactions=true is supported" }
        }

        // Convert hex to number
        const blockNumber = parseInt(blockNumberHex, 16)

        return (await getStoredBlock(this.db, this.blockstore, blockNumber.toString())).block
    }

    private async handleGetTransactionReceipt(params: any[]): Promise<any> {
        if (params.length < 1) {
            throw { ...RPC_ERRORS.INVALID_PARAMS, data: "Missing transaction hash" }
        }

        const txHash = params[0]

        return await getTxReceipt(this.db, this.blockstore, txHash)
    }

    private async handleEthCall(params: any[]): Promise<string> {
        if (params.length < 2) {
            throw { ...RPC_ERRORS.INVALID_PARAMS, data: "Missing parameters" }
        }

        const callData = params[0]
        const blockTag = params[1]

        // Check if this is a call to the WARP precompile
        const WARP_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000005'
        const getBlockchainIDFunctionSignature = '0x4213cf78'

        if (callData.to?.toLowerCase() === WARP_PRECOMPILE_ADDRESS.toLowerCase() &&
            callData.data === getBlockchainIDFunctionSignature) {
            // Return the blockchain ID from context
            const chainIdBytes = utils.base58check.decode(this.context.chainId)
            return utils.bufferToHex(chainIdBytes)
        }

        // For other eth_call requests, throw not implemented
        throw { ...RPC_ERRORS.INTERNAL_ERROR, data: "eth_call only supports WARP precompile getBlockchainID" }
    }

    private async processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
        try {
            const result = await this.handleRpcMethod(request.method, request.params || [])
            return {
                jsonrpc: "2.0",
                id: request.id,
                result
            }
        } catch (error: any) {
            if (error.code && error.message) {
                return this.createErrorResponse(request.id, error)
            }
            return this.createErrorResponse(request.id, {
                ...RPC_ERRORS.INTERNAL_ERROR,
                data: error.message || "Unknown error"
            })
        }
    }

    registerAPI = (app: OpenAPIHono) => {
        const rpcRoute = createRoute({
            method: 'post',
            path: `/rpc`,
            request: {
                body: {
                    content: {
                        'application/json': {
                            schema: z.union([
                                z.object({
                                    jsonrpc: z.literal("2.0"),
                                    id: z.union([z.number(), z.string(), z.null()]),
                                    method: z.string(),
                                    params: z.array(z.any()).optional()
                                }),
                                z.array(z.object({
                                    jsonrpc: z.literal("2.0"),
                                    id: z.union([z.number(), z.string(), z.null()]),
                                    method: z.string(),
                                    params: z.array(z.any()).optional()
                                }))
                            ])
                        }
                    }
                }
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: z.union([
                                z.object({
                                    jsonrpc: z.literal("2.0"),
                                    id: z.union([z.number(), z.string(), z.null()]),
                                    result: z.any().optional(),
                                    error: z.object({
                                        code: z.number(),
                                        message: z.string(),
                                        data: z.any().optional()
                                    }).optional()
                                }),
                                z.array(z.object({
                                    jsonrpc: z.literal("2.0"),
                                    id: z.union([z.number(), z.string(), z.null()]),
                                    result: z.any().optional(),
                                    error: z.object({
                                        code: z.number(),
                                        message: z.string(),
                                        data: z.any().optional()
                                    }).optional()
                                }))
                            ])
                        }
                    },
                    description: 'JSON-RPC response',
                },
            },
            tags: ['RPC'],
            summary: 'JSON-RPC endpoint',
            description: 'Handles JSON-RPC requests compatible with Ethereum JSON-RPC API'
        })

        app.openapi(rpcRoute, async (c) => {
            const body = await c.req.json()

            // Handle batch requests
            if (Array.isArray(body)) {
                const responses = await Promise.all(
                    body.map(request => this.processRequest(request))
                )
                return c.json(responses)
            }

            // Handle single request
            const response = await this.processRequest(body)
            return c.json(response)
        })
    }
}

export const createRpcIndexer: IndexerFactory = (context: IndexContext, isWriter: boolean): Indexer => {
    return new RpcIndexer(context, isWriter)
} 
