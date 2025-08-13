#!/bin/bash

# L1BEAT INDEXER - Easy Deployment Script
# Handles the complete deployment process automatically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 L1BEAT INDEXER - Deployment Script${NC}"
echo "======================================="

# Configuration
COMPOSE_FILE="compose.yml"
FRONTEND_DIR="frontend"
CERTS_DIR="$HOME/certs"

# Check prerequisites
check_requirements() {
    echo -e "${BLUE}📋 Checking prerequisites...${NC}"
    
    # Check if we're in the right directory
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        echo -e "${RED}❌ compose.yml not found. Are you in the L1BEAT-INDEXER directory?${NC}"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Run ./setup.sh first.${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose not found. Run ./setup.sh first.${NC}"
        exit 1
    fi
    
    # Detect Docker Compose command
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi
    
    # Check SSL certificates
    REQUIRED_CERTS=("cloudflare-origin.pem" "cloudflare-origin.key" "nginx.conf")
    for cert in "${REQUIRED_CERTS[@]}"; do
        if [[ ! -f "$CERTS_DIR/$cert" ]]; then
            echo -e "${RED}❌ SSL certificate missing: $CERTS_DIR/$cert${NC}"
            echo -e "${YELLOW}💡 Run ./setup.sh to configure certificates${NC}"
            exit 1
        fi
    done
    
    # Check Node.js version
    NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ -z "$NODE_VERSION" ]] || [[ "$NODE_VERSION" -lt 18 ]]; then
        echo -e "${RED}❌ Node.js 18+ required. Current: ${NODE_VERSION:-'not installed'}${NC}"
        echo -e "${YELLOW}💡 Run ./setup.sh to install Node.js 20${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Create production compose override
create_production_override() {
    echo -e "${BLUE}🔧 Creating production compose override...${NC}"
    
    cat > compose.override.yml << 'EOF'
services:
  fetcher:
    volumes:
      - /home/selim/L1BEAT-INDEXER/plugins:/plugins
      - /home/selim/L1BEAT-INDEXER/data:/data
  api:
    volumes:
      - /home/selim/L1BEAT-INDEXER/plugins:/plugins
      - /home/selim/L1BEAT-INDEXER/data:/data
      - /home/selim/L1BEAT-INDEXER/frontend/dist:/assets
  indexer:
    volumes:
      - /home/selim/L1BEAT-INDEXER/plugins:/plugins
      - /home/selim/L1BEAT-INDEXER/data:/data
  nginx:
    volumes:
      - /home/selim/certs/cloudflare-origin.pem:/etc/nginx/certs/cloudflare-origin.pem:ro
      - /home/selim/certs/cloudflare-origin.key:/etc/nginx/certs/cloudflare-origin.key:ro
      - /home/selim/certs/nginx.conf:/etc/nginx/nginx.conf:ro
EOF
    
    echo -e "${GREEN}✅ Created compose.override.yml with production paths${NC}"
}

# Backup current compose.yml
backup_compose() {
    if [[ -f "$COMPOSE_FILE" ]]; then
        cp "$COMPOSE_FILE" "${COMPOSE_FILE}.backup"
        echo -e "${BLUE}📁 Backed up compose.yml${NC}"
    fi
}

# Restore compose.yml from backup if something goes wrong
restore_compose() {
    if [[ -f "${COMPOSE_FILE}.backup" ]]; then
        cp "${COMPOSE_FILE}.backup" "$COMPOSE_FILE"
        echo -e "${YELLOW}🔄 Restored compose.yml from backup${NC}"
    fi
}

# Stop existing services
stop_services() {
    echo -e "${BLUE}⏹️ Stopping existing services...${NC}"
    $DOCKER_COMPOSE down 2>/dev/null || true
}

# Prepare compose.yml for initial backend startup (without frontend assets)
prepare_backend_only() {
    echo -e "${BLUE}🔧 Preparing backend-only startup...${NC}"
    
    # Comment out frontend assets temporarily
    sed -i 's|.*frontend/dist:/assets.*|      # - ./frontend/dist:/assets  # Temporarily disabled|' "$COMPOSE_FILE"
    sed -i 's|.*ASSETS_DIR=/assets.*|      # - ASSETS_DIR=/assets  # Temporarily disabled|' "$COMPOSE_FILE"
}

# Start backend services
start_backend() {
    echo -e "${BLUE}🔧 Starting backend services...${NC}"
    $DOCKER_COMPOSE up -d
    
    echo -e "${BLUE}⏳ Waiting for API to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:80/api/chains > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API is responding${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo -e "${RED}❌ API failed to start properly${NC}"
    echo -e "${YELLOW}📝 Checking logs:${NC}"
    $DOCKER_COMPOSE logs api | tail -10
    return 1
}

# Build frontend
build_frontend() {
    echo -e "${BLUE}📦 Building frontend...${NC}"
    
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        echo -e "${RED}❌ Frontend directory not found${NC}"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    echo -e "${BLUE}📥 Installing frontend dependencies...${NC}"
    npm install
    
    # Generate SDK from running backend
    echo -e "${BLUE}🔄 Generating frontend SDK...${NC}"
    if ! npm run openapi; then
        echo -e "${RED}❌ Failed to generate frontend SDK${NC}"
        echo -e "${YELLOW}💡 Make sure the backend is running and accessible${NC}"
        cd ..
        return 1
    fi
    
    # Build frontend
    echo -e "${BLUE}🏗️ Building frontend...${NC}"
    if ! npm run build; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        cd ..
        return 1
    fi
    
    cd ..
    
    # Verify build output
    if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
        echo -e "${RED}❌ Frontend build output missing${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
}

# Enable frontend assets in compose.yml
enable_frontend() {
    echo -e "${BLUE}🎨 Enabling frontend assets...${NC}"
    
    # Restore frontend assets lines
    sed -i 's|.*# - ./frontend/dist:/assets.*|      - ./frontend/dist:/assets|' "$COMPOSE_FILE"
    sed -i 's|.*# - ASSETS_DIR=/assets.*|      - ASSETS_DIR=/assets|' "$COMPOSE_FILE"
}

# Restart services with frontend
restart_with_frontend() {
    echo -e "${BLUE}🔄 Restarting services with frontend...${NC}"
    $DOCKER_COMPOSE restart api
    
    # Wait for services to be ready
    echo -e "${BLUE}⏳ Waiting for services to restart...${NC}"
    sleep 10
}

# Verify deployment
verify_deployment() {
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"
    
    # Check all containers are running
    if ! $DOCKER_COMPOSE ps | grep -q "Up"; then
        echo -e "${RED}❌ Some containers are not running${NC}"
        $DOCKER_COMPOSE ps
        return 1
    fi
    
    # Test API endpoint
    if ! curl -s http://localhost:80/api/chains > /dev/null; then
        echo -e "${RED}❌ API not responding${NC}"
        return 1
    fi
    
    # Test frontend
    if ! curl -s https://localhost/ -k | grep -q "html"; then
        echo -e "${RED}❌ Frontend not loading${NC}"
        return 1
    fi
    
    # Test organized API docs
    if ! curl -s https://localhost/api/docs -k > /dev/null; then
        echo -e "${RED}❌ API documentation not accessible${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All services verified successfully${NC}"
}

# Show deployment status
show_status() {
    echo ""
    echo -e "${GREEN}🎉 L1BEAT INDEXER Deployment Complete!${NC}"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}📊 Service Status:${NC}"
    $DOCKER_COMPOSE ps
    echo ""
    echo -e "${BLUE}🌐 Access Points:${NC}"
    echo -e "${GREEN}  Dashboard:        https://localhost/${NC}"
    echo -e "${GREEN}  API Documentation: https://localhost/api/docs${NC}"
    echo -e "${GREEN}  OpenAPI Spec:     https://localhost/api/openapi.json${NC}"
    echo ""
    echo -e "${BLUE}📋 Organized API Categories:${NC}"
    echo "  📊 Transaction Analytics"
    echo "  👥 User Analytics" 
    echo "  ⛽ Gas Analytics"
    echo "  📨 Cross-Chain Messaging"
    echo "  🪙 Token Transfers"
    echo "  🧱 Blocks"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "  View logs:    $DOCKER_COMPOSE logs -f"
    echo "  Stop:         $DOCKER_COMPOSE down"
    echo "  Restart:      $DOCKER_COMPOSE restart"
    echo "  Update:       git pull && ./deploy.sh"
}

# Cleanup function for errors
cleanup_on_error() {
    echo -e "${RED}❌ Deployment failed${NC}"
    echo -e "${YELLOW}🔄 Cleaning up...${NC}"
    
    restore_compose
    stop_services
    
    echo -e "${YELLOW}📝 Checking logs for errors:${NC}"
    $DOCKER_COMPOSE logs api 2>/dev/null | tail -10 || true
    
    exit 1
}

# Set up error handling
trap cleanup_on_error ERR

# Main deployment process
main() {
    check_requirements
    create_production_override
    backup_compose
    stop_services
    prepare_backend_only
    
    if ! start_backend; then
        cleanup_on_error
    fi
    
    if ! build_frontend; then
        cleanup_on_error
    fi
    
    enable_frontend
    restart_with_frontend
    
    if ! verify_deployment; then
        cleanup_on_error
    fi
    
    # Clean up backup
    rm -f "${COMPOSE_FILE}.backup"
    
    show_status
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "L1BEAT INDEXER Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --status       Show current deployment status"
        echo "  --stop         Stop all services"
        echo "  --logs         Show service logs"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh              # Full deployment"
        echo "  ./deploy.sh --status     # Check status"
        echo "  ./deploy.sh --stop       # Stop services"
        ;;
    --status)
        echo -e "${BLUE}📊 L1BEAT INDEXER Status${NC}"
        if command -v docker-compose &> /dev/null; then
            docker-compose ps
        else
            docker compose ps
        fi
        ;;
    --stop)
        echo -e "${BLUE}⏹️ Stopping L1BEAT INDEXER services...${NC}"
        if command -v docker-compose &> /dev/null; then
            docker-compose down
        else
            docker compose down
        fi
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
    --logs)
        echo -e "${BLUE}📝 L1BEAT INDEXER Logs${NC}"
        if command -v docker-compose &> /dev/null; then
            docker-compose logs -f
        else
            docker compose logs -f
        fi
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac