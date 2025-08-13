import fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastifyRateLimit from '@fastify/rate-limit';
import { database, type NodeAssignment } from './database.js';
import { checkSubnetExists, getSubnetIdFromChainId, getNodeInfo, NodeInfoResult, NodeInfoResponse } from './node_apis.js';
import { generateDockerCompose } from './docker-composer.js';
import { ADMIN_PASSWORD, INIT_CONTAINERS_INTERVAL_MS } from './config.js';

// TODO: fix - move bootstrap error message to const as required
const BOOTSTRAP_ERROR_MESSAGE = 'Node is not ready or still bootstrapping';

// Helper function to build subnet status response
async function buildSubnetStatusResponse(subnetId: string, assignments: NodeAssignment[]) {
    if (assignments.length === 0) {
        return {
            subnetId: subnetId,
            nodes: []
        };
    }

    const nodes = [];
    for (const assignment of assignments.sort((a, b) => a.nodeIndex - b.nodeIndex)) {
        const nodeInfo = await getNodeInfo(9652 + assignment.nodeIndex * 2);
        if (!nodeInfo.result) {
            throw new Error(`Nodeinfo call failed for node ${assignment.nodeIndex} with error: ${JSON.stringify(nodeInfo.error || "Unknown error")}`);
        }

        console.log(`Nodeinfo call for node ${assignment.nodeIndex} returned: ${JSON.stringify(nodeInfo)}`);

        nodes.push({
            nodeIndex: assignment.nodeIndex,
            nodeInfo: { result: { ...nodeInfo.result } },
            dateCreated: assignment.dateCreated,
            expiresAt: assignment.expiresAt
        });
    }

    return {
        subnetId: subnetId,
        nodes: nodes
    };
}

async function createServer() {
    const server = fastify({ logger: true });

    // Register rate limiting
    await server.register(fastifyRateLimit, {
        max: 100, // Maximum 100 requests
        timeWindow: '1 minute', // Per 1 minute
        cache: 10000,
        errorResponseBuilder: function (request, context) {
            return {
                statusCode: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Retry in ${context.after}`,
                retryAfter: Math.round(context.ttl / 1000) // Convert ms to seconds
            };
        }
    });

    // Register Swagger (OpenAPI) documentation
    await server.register(fastifySwagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'SlimNode API',
                description: 'API service that manages multiple Avalanche nodes with automatic subnet registration and explicit node assignment',
                version: '1.0.0'
            },
            servers: [
                {
                    url: 'https://multinode-experimental.solokhin.com',
                    description: 'Dev preview server'
                },
                {
                    url: 'http://localhost:3000',
                    description: 'Development server'
                },
            ],
            tags: [
                {
                    name: 'admin',
                    description: 'Admin endpoints for managing subnet nodes (requires authentication)'
                },
                {
                    name: 'proxy',
                    description: 'RPC proxy endpoints for blockchain interaction'
                }
            ],
            components: {
                securitySchemes: {
                    adminPassword: {
                        type: 'apiKey',
                        name: 'password',
                        in: 'query',
                        description: 'Admin password for authentication'
                    }
                }
            }
        }
    });

    // Register Swagger UI
    await server.register(fastifySwaggerUI, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            persistAuthorization: true
        },
        staticCSP: true,
        transformSpecification: (swaggerObject, request, reply) => {
            // You can transform the spec here if needed
            return swaggerObject;
        }
    });

    // Initialize Docker containers on startup
    async function initializeContainers() {
        console.log('Starting Docker containers...');
        await generateDockerCompose(); // Generate compose file and start containers on initial startup
    }

    // Start initialization
    setInterval(() => initializeContainers().catch(e => {
        console.error('Error initializing containers:', e);
    }), INIT_CONTAINERS_INTERVAL_MS);

    // Authentication middleware for admin endpoints
    server.addHook('preHandler', (req, reply, done) => {
        if (req.url.startsWith('/node_admin/')) {
            const { password } = req.query as { password?: string };
            if (!password || password !== ADMIN_PASSWORD) {
                console.log(`Unauthorized admin access from ${req.ip}`);
                reply.code(401).send({ error: 'Unauthorized' });
                return;
            }
        }
        done();
    });

    server.get('/node_admin/subnets/status/:subnetId', {
        schema: {
            tags: ['admin'],
            summary: 'Get subnet status',
            description: 'Returns detailed information about all nodes assigned to a subnet',
            params: {
                type: 'object',
                properties: {
                    subnetId: {
                        type: 'string',
                        description: 'The subnet ID'
                    }
                },
                required: ['subnetId']
            },
            querystring: {
                type: 'object',
                properties: {
                    password: {
                        type: 'string',
                        description: 'Admin password'
                    }
                },
                required: ['password']
            },
            response: {
                200: {
                    description: 'Successful response',
                    type: 'object',
                    properties: {
                        subnetId: { type: 'string' },
                        nodes: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    nodeIndex: { type: 'number' },
                                    nodeInfo: {
                                        type: 'object',
                                        properties: {
                                            result: {
                                                type: 'object',
                                                properties: {
                                                    nodeID: { type: 'string' },
                                                    nodePOP: {
                                                        type: 'object',
                                                        properties: {
                                                            publicKey: { type: 'string' },
                                                            proofOfPossession: { type: 'string' }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    dateCreated: { type: 'number' },
                                    expiresAt: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                404: {
                    description: 'Node info request failed',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            },
            security: [{ adminPassword: [] }]
        }
    }, async (req, reply) => {
        const { subnetId } = req.params as { subnetId: string };
        const assignments = database.getSubnetAssignments(subnetId);

        try {
            const response = await buildSubnetStatusResponse(subnetId, assignments);
            return reply.send(response);
        } catch (error) {
            return reply.code(404).send({
                error: error instanceof Error ? error.message : 'Failed to get subnet status'
            });
        }
    });

    server.post('/node_admin/subnets/add/:subnetId', {
        schema: {
            tags: ['admin'],
            summary: 'Add node to subnet',
            description: 'Assigns an available node to the subnet',
            params: {
                type: 'object',
                properties: {
                    subnetId: {
                        type: 'string',
                        description: 'The subnet ID'
                    }
                },
                required: ['subnetId']
            },
            querystring: {
                type: 'object',
                properties: {
                    password: {
                        type: 'string',
                        description: 'Admin password'
                    }
                },
                required: ['password']
            },
            response: {
                200: {
                    description: 'Successful response',
                    type: 'object',
                    properties: {
                        subnetId: { type: 'string' },
                        nodes: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    nodeIndex: { type: 'number' },
                                    nodeInfo: {
                                        type: 'object',
                                        properties: {
                                            result: {
                                                type: 'object',
                                                properties: {
                                                    nodeID: { type: 'string' },
                                                    nodePOP: {
                                                        type: 'object',
                                                        properties: {
                                                            publicKey: { type: 'string' },
                                                            proofOfPossession: { type: 'string' }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    dateCreated: { type: 'number' },
                                    expiresAt: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Bad request',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                500: {
                    description: 'Internal server error',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            },
            security: [{ adminPassword: [] }]
        }
    }, async (req, reply) => {
        const { subnetId } = req.params as { subnetId: string };

        // Validate subnet exists on Avalanche network
        const subnetExists = await checkSubnetExists(subnetId);
        if (!subnetExists) {
            return reply.code(400).send({
                error: `Subnet ${subnetId} does not exist on Avalanche network`
            });
        }

        try {
            // Add a node to the subnet
            const newAssignment = database.addNodeToSubnet(subnetId);

            // Get all assignments including the new one
            const allAssignments = database.getSubnetAssignments(subnetId);

            // Build response with all nodes BEFORE restarting containers
            let response;
            try {
                response = await buildSubnetStatusResponse(subnetId, allAssignments);
            } catch (error) {
                // Remove the assignment if we can't get node info
                database.removeAssignment(subnetId, newAssignment.nodeIndex);
                return reply.code(500).send({
                    error: error instanceof Error ? error.message : 'Failed to get node info'
                });
            }

            // Now regenerate docker compose and restart containers
            await generateDockerCompose();

            return reply.send(response);
        } catch (error) {
            return reply.code(500).send({
                error: error instanceof Error ? error.message : 'Failed to add node to subnet'
            });
        }
    });

    server.delete('/node_admin/subnets/delete/:subnetId/:nodeIndex', {
        schema: {
            tags: ['admin'],
            summary: 'Remove node from subnet',
            description: 'Removes a specific node from the subnet',
            params: {
                type: 'object',
                properties: {
                    subnetId: {
                        type: 'string',
                        description: 'The subnet ID'
                    },
                    nodeIndex: {
                        type: 'string',
                        description: 'The node index to remove'
                    }
                },
                required: ['subnetId', 'nodeIndex']
            },
            querystring: {
                type: 'object',
                properties: {
                    password: {
                        type: 'string',
                        description: 'Admin password'
                    }
                },
                required: ['password']
            },
            response: {
                200: {
                    description: 'Successful response',
                    type: 'object',
                    properties: {
                        subnetId: { type: 'string' },
                        nodes: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    nodeIndex: { type: 'number' },
                                    nodeInfo: {
                                        type: 'object',
                                        properties: {
                                            result: {
                                                type: 'object',
                                                properties: {
                                                    nodeID: { type: 'string' },
                                                    nodePOP: {
                                                        type: 'object',
                                                        properties: {
                                                            publicKey: { type: 'string' },
                                                            proofOfPossession: { type: 'string' }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    dateCreated: { type: 'number' },
                                    expiresAt: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                400: {
                    description: 'Bad request',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                404: {
                    description: 'Assignment not found',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            },
            security: [{ adminPassword: [] }]
        }
    }, async (req, reply) => {
        const { subnetId, nodeIndex: nodeIndexStr } = req.params as { subnetId: string, nodeIndex: string };
        const nodeIndex = parseInt(nodeIndexStr);

        if (isNaN(nodeIndex) || nodeIndex < 0) {
            return reply.code(400).send({
                error: 'Invalid nodeIndex parameter'
            });
        }

        // First, get the current assignment to verify it exists
        const currentAssignment = database.getSubnetAssignments(subnetId)
            .find(a => a.nodeIndex === nodeIndex);

        if (!currentAssignment) {
            return reply.code(404).send({
                error: `Assignment not found for subnet ${subnetId} and node ${nodeIndex}`
            });
        }

        // Remove the assignment
        database.removeAssignment(subnetId, nodeIndex);

        // Get remaining assignments and build response BEFORE restarting containers
        const remainingAssignments = database.getSubnetAssignments(subnetId);

        try {
            const response = await buildSubnetStatusResponse(subnetId, remainingAssignments);

            // Now regenerate docker compose and restart containers
            await generateDockerCompose();

            return reply.send(response);
        } catch (error) {
            // Note: We cannot easily rollback here since the assignment is already removed
            // and docker compose might have been partially executed
            return reply.code(500).send({
                error: error instanceof Error ? error.message : 'Failed to complete deletion'
            });
        }
    });

    // OPTIONS handler for CORS preflight
    server.options('/ext/bc/:chainId/rpc', {
        schema: {
            hide: true // Hide from docs as it's just CORS
        }
    }, async (req, reply) => {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        reply.header('Access-Control-Allow-Headers', '*');
        reply.code(200).send();
    });

    server.get('/ext/bc/:chainId/rpc', {
        schema: {
            tags: ['proxy'],
            summary: 'Get RPC endpoint status',
            description: 'Check the status of a blockchain RPC endpoint',
            params: {
                type: 'object',
                properties: {
                    chainId: {
                        type: 'string',
                        description: 'The blockchain ID'
                    }
                },
                required: ['chainId']
            },
            response: {
                200: {
                    description: 'Healthy endpoint',
                    type: 'string'
                },
                404: {
                    description: 'Chain not found',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                500: {
                    description: 'Internal error',
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        chainId: { type: 'string' }
                    }
                },
                503: {
                    description: 'Service unavailable',
                    type: 'string'
                }
            }
        }
    }, async (req, reply) => {
        const { chainId } = req.params as { chainId: string };

        // Add CORS headers
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        reply.header('Access-Control-Allow-Headers', '*');

        try {
            // Get subnetId from chainId using cached lookup
            const subnetId = await getSubnetIdFromChainId(chainId);
            if (!subnetId) {
                return reply.code(404).send({
                    error: `Chain ${chainId} not found or invalid`
                });
            }

            const assignments = database.getSubnetAssignments(subnetId);
            if (assignments.length === 0) {
                return reply.code(404).send({
                    error: `Subnet ${subnetId} not found in database`
                });
            }

            const nodeIndex = assignments[0].nodeIndex; // Get the first node hosting this subnet
            const nodePort = 9652 + (nodeIndex * 2);

            let status = 'not healthy - node is not ready or still bootstrapping';
            let evmChainIdText = '';

            // Test if node is alive and get chain ID
            try {
                const targetUrl = `http://localhost:${nodePort}/ext/bc/${chainId}/rpc`;
                const chainIdResponse = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_chainId',
                        params: [],
                        id: 1
                    })
                });

                if (chainIdResponse.ok) {
                    const chainIdData = await chainIdResponse.json() as { result?: string };
                    if (chainIdData.result) {
                        const evmChainId = parseInt(chainIdData.result, 16);
                        status = 'healthy';
                        evmChainIdText = `, EVM Chain ID: ${evmChainId}`;
                    }
                }
            } catch (error) {
                // status already set to not healthy
            }

            if (status === 'healthy') {
                return reply.code(200).send(`Blockchain ID: ${chainId}, Subnet ID: ${subnetId}, Status: ${status}${evmChainIdText}. To do actual RPC requests you need to issue a POST request.`);
            } else {
                return reply.code(503).send(`Blockchain ID: ${chainId}, Subnet ID: ${subnetId}, Status: ${status}`);
            }

        } catch (error) {
            console.error('Error testing node health:', error);
            return reply.code(500).send({
                error: 'Internal proxy error',
                chainId
            });
        }
    });

    // Proxy endpoint - forwards RPC requests to appropriate node
    server.post('/ext/bc/:chainId/rpc', {
        schema: {
            tags: ['proxy'],
            summary: 'Forward RPC request',
            description: 'Forwards JSON-RPC requests to the appropriate node',
            params: {
                type: 'object',
                properties: {
                    chainId: {
                        type: 'string',
                        description: 'The blockchain ID'
                    }
                },
                required: ['chainId']
            },
            body: {
                type: 'object',
                description: 'JSON-RPC request body',
                examples: [
                    {
                        jsonrpc: '2.0',
                        method: 'eth_chainId',
                        params: [],
                        id: 1
                    }
                ]
            },
            response: {
                200: {
                    description: 'Successful RPC response',
                    type: 'object'
                },
                404: {
                    description: 'Chain not found',
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                500: {
                    description: 'Internal proxy error',
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        chainId: { type: 'string' }
                    }
                },
                503: {
                    description: 'Node not ready',
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        chainId: { type: 'string' },
                        retry: { type: 'boolean' }
                    }
                }
            }
        }
    }, async (req, reply) => {
        const { chainId } = req.params as { chainId: string };

        // Add CORS headers
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        reply.header('Access-Control-Allow-Headers', '*');

        try {
            const subnetId = await getSubnetIdFromChainId(chainId);
            if (!subnetId) {
                return reply.code(404).send({
                    error: `Chain ${chainId} not found or invalid`
                });
            }

            const assignments = database.getSubnetAssignments(subnetId);
            if (assignments.length === 0) {
                return reply.code(404).send({
                    error: `Subnet ${subnetId} not found in database`
                });
            }

            const nodeIndex = assignments[0].nodeIndex; // Get the first node hosting this subnet
            const nodePort = 9652 + (nodeIndex * 2);

            // Forward request to node
            const targetUrl = `http://localhost:${nodePort}/ext/bc/${chainId}/rpc`;

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(
                        Object.entries(req.headers).filter(([key]) =>
                            key.startsWith('x-') || key === 'user-agent'
                        )
                    )
                },
                body: JSON.stringify(req.body)
            });

            // Forward response as-is
            const data = await response.text();
            reply.code(response.status)
                .header('Content-Type', response.headers.get('Content-Type') || 'application/json')
                .send(data);

        } catch (error) {
            console.error('Error proxying request:', error);

            if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
                return reply.code(503).send({
                    error: BOOTSTRAP_ERROR_MESSAGE,
                    chainId,
                    retry: true
                });
            }

            return reply.code(500).send({
                error: 'Internal proxy error',
                chainId
            });
        }
    });

    return server;
}

// Export the createServer function
export { createServer }; 
