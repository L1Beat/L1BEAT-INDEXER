import SQLite from "better-sqlite3";
import { BlockDB } from "../blockFetcher/BlockDB";
import { CreateIndexerFunction, Indexer } from "./types";
import { LazyTx, lazyTxToReceipt } from "../blockFetcher/lazy/LazyTx";
import { LazyBlock } from "../blockFetcher/lazy/LazyBlock";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { lazyBlockToBlock } from "../blockFetcher/lazy/LazyBlock";
import { LazyTraces } from "../blockFetcher/lazy/LazyTrace";

// Define schemas for RPC requests and responses
const RPCRequestSchema = z.object({
    method: z.string().openapi({
        example: 'eth_chainId',
        description: 'The RPC method to call'
    }),
    params: z.array(z.any()).openapi({
        example: [],
        description: 'Parameters for the RPC method'
    }),
    id: z.union([z.string(), z.number()]).optional().openapi({
        example: 1,
        description: 'Request ID'
    }),
    jsonrpc: z.string().optional().openapi({
        example: '2.0',
        description: 'JSON-RPC version'
    })
}).openapi('RPCRequest');

const RPCResponseSchema = z.object({
    result: z.any().optional().openapi({
        description: 'The result of the RPC call'
    }),
    error: z.object({
        code: z.number().openapi({
            example: -32601,
            description: 'Error code'
        }),
        message: z.string().openapi({
            example: 'Method not found',
            description: 'Error message'
        })
    }).optional().openapi({
        description: 'Error object if the call failed'
    }),
    id: z.union([z.string(), z.number()]).optional().openapi({
        description: 'Request ID'
    }),
    jsonrpc: z.string().optional().openapi({
        example: '2.0',
        description: 'JSON-RPC version'
    })
}).openapi('RPCResponse');

const RPCBatchRequestSchema = z.union([
    RPCRequestSchema,
    z.array(RPCRequestSchema)
]).openapi('RPCBatchRequest');

const RPCBatchResponseSchema = z.union([
    RPCResponseSchema,
    z.array(RPCResponseSchema)
]).openapi('RPCBatchResponse');

class RPCIndexer implements Indexer {
    constructor(private blocksDb: BlockDB, private indexingDb: SQLite.Database) {

    }

    initialize(): void {
        // No init - just use existing tables
    }

    indexBlock(block: LazyBlock, txs: LazyTx[], traces: LazyTraces | undefined): void {
        //No actual indexing, just raw block ops
    }

    registerRoutes(app: OpenAPIHono): void {
        const rpcRoute = createRoute({
            method: 'post',
            path: '/rpc',
            request: {
                body: {
                    content: {
                        'application/json': {
                            schema: RPCBatchRequestSchema
                        }
                    }
                }
            },
            responses: {
                200: {
                    content: {
                        'application/json': {
                            schema: RPCBatchResponseSchema
                        }
                    },
                    description: 'RPC response'
                }
            },
            tags: ['RPC'],
            summary: 'JSON-RPC endpoint',
            description: 'Handles JSON-RPC requests for blockchain data'
        });

        app.openapi(rpcRoute, (c) => {
            const requests = c.req.valid('json');
            if (Array.isArray(requests)) {
                return c.json(requests.map(req => this.handleRPCRequest(req)));
            } else {
                return c.json(this.handleRPCRequest(requests));
            }
        });
    }

    private handleRPCRequest(request: RPCRequest): any {
        const response: any = {
            id: request.id,
            jsonrpc: request.jsonrpc || '2.0'
        };

        if (request.method === 'eth_chainId') {
            response.result = '0x' + this.blocksDb.getEvmChainId().toString(16);
        } else if (request.method === 'eth_getTransactionReceipt') {
            response.error = {
                code: -32015,
                message: 'eth_getTransactionReceipt is not implemented yet - no hash to tx number lookup table. TODO: implement'
            };
        } else if (request.method === 'eth_getBlockByNumber') {
            const blockNumber = request.params[0];
            const { block, txs } = this.blocksDb.getBlockWithTransactions(blockNumber);
            response.result = lazyBlockToBlock(block, txs);
        } else {
            response.error = {
                code: -32601,
                message: 'Method not found. Implement it in ./indexers/rpc.ts'
            };
        }

        return response;
    }
}

export const createRPCIndexer: CreateIndexerFunction = (blocksDb, indexingDb) => {
    return new RPCIndexer(blocksDb, indexingDb);
}

type RPCRequest = z.infer<typeof RPCRequestSchema>;
type RPCResponse = z.infer<typeof RPCResponseSchema>;
