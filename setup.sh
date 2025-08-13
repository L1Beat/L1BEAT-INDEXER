#!/bin/bash

# L1BEAT INDEXER - One-time Environment Setup Script
# Run this once on a new server to prepare the environment

set -e

echo "🚀 L1BEAT INDEXER - Environment Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ Don't run this script as root${NC}"
   exit 1
fi

echo -e "${BLUE}📋 Checking system requirements...${NC}"

# Check Ubuntu version
if ! grep -q "Ubuntu" /etc/os-release; then
    echo -e "${YELLOW}⚠️ This script is designed for Ubuntu. Proceed with caution.${NC}"
fi

# Update system packages
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt update

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${BLUE}🐳 Installing Docker...${NC}"
    sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker installed. You may need to log out and back in.${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo -e "${BLUE}🔧 Installing Docker Compose...${NC}"
    sudo apt install -y docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Install modern Node.js
NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [[ -z "$NODE_VERSION" ]] || [[ "$NODE_VERSION" -lt 18 ]]; then
    echo -e "${BLUE}📱 Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✅ Node.js $(node --version) installed${NC}"
else
    echo -e "${GREEN}✅ Node.js $(node --version) already installed${NC}"
fi

# Check SSL certificates directory
echo -e "${BLUE}🔒 Checking SSL certificates...${NC}"
if [[ ! -d "$HOME/certs" ]]; then
    echo -e "${YELLOW}⚠️ SSL certificates directory not found${NC}"
    echo -e "${BLUE}📁 Creating ~/certs directory...${NC}"
    mkdir -p ~/certs
    
    echo -e "${YELLOW}🔑 Please add your SSL certificates to ~/certs/:${NC}"
    echo "   - cloudflare-origin.pem"
    echo "   - cloudflare-origin.key" 
    echo "   - nginx.conf"
    echo ""
    echo -e "${BLUE}📝 Example nginx.conf will be created...${NC}"
    
    # Create example nginx.conf
    cat > ~/certs/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:80;
    }

    server {
        listen 443 ssl;
        server_name localhost;

        ssl_certificate /etc/nginx/certs/cloudflare-origin.pem;
        ssl_certificate_key /etc/nginx/certs/cloudflare-origin.key;
        
        # CORS headers for development
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }

        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
    echo -e "${GREEN}✅ Example nginx.conf created${NC}"
else
    echo -e "${GREEN}✅ SSL certificates directory exists${NC}"
    
    # Check for required files
    CERT_FILES=("cloudflare-origin.pem" "cloudflare-origin.key" "nginx.conf")
    for file in "${CERT_FILES[@]}"; do
        if [[ -f "$HOME/certs/$file" ]]; then
            echo -e "${GREEN}  ✅ $file found${NC}"
        else
            echo -e "${RED}  ❌ $file missing${NC}"
        fi
    done
fi

# Check Git configuration
echo -e "${BLUE}📋 Checking Git configuration...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${BLUE}📦 Installing Git...${NC}"
    sudo apt install -y git
fi

if [[ -z "$(git config --global user.name)" ]]; then
    echo -e "${YELLOW}⚠️ Git user name not configured${NC}"
    echo "Run: git config --global user.name 'Your Name'"
fi

if [[ -z "$(git config --global user.email)" ]]; then
    echo -e "${YELLOW}⚠️ Git user email not configured${NC}"
    echo "Run: git config --global user.email 'your.email@example.com'"
fi

echo ""
echo -e "${GREEN}🎉 Environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "1. Add your SSL certificates to ~/certs/"
echo "2. Clone your repository: git clone https://github.com/L1Beat/L1BEAT-INDEXER.git"
echo "3. Run the deployment: cd L1BEAT-INDEXER && ./deploy.sh"
echo ""
echo -e "${YELLOW}💡 If you added yourself to the docker group, you may need to log out and back in.${NC}"
