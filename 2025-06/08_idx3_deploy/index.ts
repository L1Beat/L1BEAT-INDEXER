import fs from 'fs'
import chains from "../01_rpc_list/data/chains.json"
import YAML from 'yaml'

// Build services object
const services: Record<string, any> = {}

function getRps(endpoint: string) {
    if (endpoint.includes("meganode.solokhin.com")) {
        return 200
    } else if (endpoint.includes("subnets.avax.network")) {
        return 3//TODO: change to 6. UP: even 5 throws 429
    } else {
        return 20
    }
}

function getMaxConcurrent(endpoint: string) {
    return 20
}

function replaceRpcUrl(endpoint: string) {
    return endpoint.replace("https://meganode.solokhin.com", "http://65.21.140.118")
}

function getBlocksPerBatch(endpoint: string) {
    return 200
}

function getRequestBatchSize(endpoint: string) {
    return 10
}

for (const chain of chains) {
    // Only add service if rpcUrl is present and not empty/null
    if (chain.rpcUrl) {

        services[`indexer_${chain.blockchainId}`] = {
            image: "containerman17/idx3:latest",
            container_name: `indexer_${chain.blockchainId}`,
            environment: [
                `RPC_URL=${replaceRpcUrl(chain.rpcUrl)}`,
                `CHAIN_ID=${chain.blockchainId}`,
                "DATA_DIR=/data/",
                `RPS=${getRps(chain.rpcUrl)}`,
                `REQUEST_BATCH_SIZE=${getRequestBatchSize(chain.rpcUrl)}`,
                `MAX_CONCURRENT=${getMaxConcurrent(chain.rpcUrl)}`,
                `BLOCKS_PER_BATCH=${getBlocksPerBatch(chain.rpcUrl)}`,
                `DEBUG_RPC_AVAILABLE=${chain.debugEnabled ? 'true' : 'false'}`,
                ...chain.evmChainId ? [`REVERSE_PROXY_PREFIX=/v1/chains/${chain.evmChainId}`] : []
            ],
            volumes: [
                "/home/ilia/indexer_data:/data"
            ],
            // Remove external port exposure - access via nginx only
            restart: "on-failure:100" // Add restart policy with sane limit
        }
    }
}

// Generate nginx configuration
let nginxLocationBlocks = ''
for (const chain of chains) {
    if (chain.rpcUrl && chain.evmChainId) {
        nginxLocationBlocks += `
        location ~ ^/(v1|v2)/chains/${chain.evmChainId}/(.*) {
            rewrite ^/(v1|v2)/chains/${chain.evmChainId}/(.*) /\$2 break;
            proxy_pass http://indexer_${chain.blockchainId}:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        `
    }
}

const nginxConfig = `
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    keepalive_timeout 65;
    
    # Rate limiting zone: 100 requests per second per IP with burst of 1000
    limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req_status 429;
    
    server {
        listen 80;
        server_name _;
        
        # Apply rate limiting globally
        limit_req zone=api_limit burst=1000 nodelay;
        
        ${nginxLocationBlocks}
        
        # Dashboard proxy
        location / {
            proxy_pass http://dashboard:80;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
`

services["nginx"] = {
    image: "nginx:alpine",
    container_name: "nginx",
    ports: [
        "80:80"
    ],
    volumes: [
        "./nginx.conf:/etc/nginx/nginx.conf:ro"
    ],
    depends_on: Object.keys(services).filter(service => service !== "nginx"),
    restart: "on-failure:100"
}

services["dashboard"] = {
    image: "containerman17/idx3-dashboard",
    container_name: "dashboard",
    // Remove external port exposure - access via nginx only
    labels: {
    },
    restart: "on-failure:100"
}

// Write nginx config to a file
fs.writeFileSync('nginx.conf', nginxConfig)

const composeObject = {
    services,
    networks: {},
    volumes: {
    }
}
const yamlStr = YAML.stringify(composeObject)
fs.writeFileSync('compose.yml', yamlStr)
