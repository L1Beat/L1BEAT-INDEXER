# SlimNode

API service for managing Avalanche subnet nodes with Docker container
orchestration.

## Overview

SlimNode provides HTTP endpoints to dynamically assign/remove Avalanche nodes to
subnets. It automatically manages Docker containers running subnet-evm
avalanchego nodes.

## Configuration

Environment variables:

- `ADMIN_PASSWORD` (required) - Password for admin endpoints
- `NODE_COUNT` - Number of subnet nodes to manage (default: 0)
- `DATA_DIR` - Directory for database file (default: ./data)

Fixed configuration values:

- Assignment expiration: 5 minutes
- Subnets per node: 1
- Max nodes per subnet: 3
- Container initialization interval: 30 seconds

## API Endpoints

All admin endpoints require `?password=<ADMIN_PASSWORD>` query parameter.

### GET /node_admin/subnets/status/:subnetId

Returns nodes assigned to a subnet.

Response:

```json
{
  "subnetId": "...",
  "nodes": [
    {
      "nodeIndex": 0,
      "nodeInfo": {
        "result": {
          "nodeID": "NodeID-...",
          "nodePOP": {
            "publicKey": "...",
            "proofOfPossession": "..."
          }
        }
      },
      "dateCreated": 1234567890,
      "expiresAt": 1234567890
    }
  ]
}
```

### POST /node_admin/subnets/add/:subnetId

Assigns an available node to the subnet. Maximum 3 nodes per subnet. Validates
subnet exists on Avalanche network before assignment.

Returns the same response format as status endpoint with all assigned nodes.

### DELETE /node_admin/subnets/delete/:subnetId/:nodeIndex

Removes a specific node from the subnet.

Returns the same response format as status endpoint with remaining nodes.

### GET /ext/bc/:chainId/rpc

Health check for blockchain RPC endpoint. Returns status text including EVM
chain ID if healthy.

### POST /ext/bc/:chainId/rpc

Proxies JSON-RPC requests to the appropriate node hosting the chain's subnet.

## Rate Limiting

All endpoints are rate limited to 100 requests per minute per IP address using
@fastify/rate-limit.

## API Documentation

Interactive OpenAPI 3.0 documentation available at:

- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/json
- OpenAPI YAML: http://localhost:3000/docs/yaml

## Database

JSON file database stored at `{DATA_DIR}/chains.json` containing:

```json
{
  "assignments": [
    {
      "nodeIndex": 0,
      "subnetId": "...",
      "dateCreated": 1234567890,
      "expiresAt": 1234567890
    }
  ]
}
```

Automatic backup saved to `chains.backup.json` on every write.

## Docker Architecture

- **bootnode**: Runs on ports 9650/9651, serves as bootstrap node
- **node_0000, node_0001, etc**: Subnet nodes starting from ports 9652/9653
  (increment by 2)

Containers use:

- Image: `avaplatform/subnet-evm_avalanchego:latest`
- Network: host mode
- Volumes: `/avadata/{container_name}:/root/.avalanchego`
- Environment: Fuji testnet configuration

Fast bootstrap feature copies bootnode data to new nodes for faster
initialization.

## Node Assignment Logic

1. When adding a node to subnet:
   - Validates subnet exists on Avalanche network
   - Finds available node (not already assigned to subnet, under subnet limit)
   - If no slots available, removes oldest assignment by expiration time
   - Creates assignment with 5-minute expiration

2. Docker compose regeneration:
   - Triggered on any assignment change
   - Runs every 30 seconds to check bootnode bootstrap status
   - Only starts subnet nodes after bootnode is bootstrapped

## Example Usage

See `example/example-usage.ts` for a complete example using the TypeScript API
client.
