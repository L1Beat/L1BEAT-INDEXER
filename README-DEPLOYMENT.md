# 🚀 L1BEAT INDEXER - Easy Deployment Guide

This guide provides automated scripts for painless deployment of the L1BEAT INDEXER with organized API categories and modern dashboard.

## 📋 Quick Start

### One-Time Setup (New Server)
```bash
# 1. Run the setup script
curl -sSL https://raw.githubusercontent.com/L1Beat/L1BEAT-INDEXER/main/setup.sh | bash

# 2. Add your SSL certificates to ~/certs/
cp your-cloudflare-origin.pem ~/certs/cloudflare-origin.pem
cp your-cloudflare-origin.key ~/certs/cloudflare-origin.key

# 3. Clone the repository
git clone https://github.com/L1Beat/L1BEAT-INDEXER.git
cd L1BEAT-INDEXER
```

### Deploy/Update
```bash
# One-command deployment
./deploy.sh
```

## 🛠️ Deployment Scripts

### `setup.sh` - Environment Setup
**Run once per server**
- ✅ Installs Docker & Docker Compose
- ✅ Installs Node.js 20
- ✅ Creates SSL certificate directories
- ✅ Configures development environment

### `deploy.sh` - Automated Deployment
**Run for each deployment/update**
- ✅ Validates prerequisites
- ✅ Handles backend/frontend build order
- ✅ Manages volume mounting issues
- ✅ Verifies deployment success
- ✅ Shows organized API categories

## 📊 What Gets Deployed

### Professional API Organization
- 📊 **Transaction Analytics** - TPS stats, cumulative transactions
- 👥 **User Analytics** - Daily active addresses, user metrics  
- ⛽ **Gas Analytics** - Gas usage, cumulative gas consumption
- 📨 **Cross-Chain Messaging** - ICM, Teleporter, LayerZero APIs
- 🪙 **Token Transfers** - ICTT transfers, TVL analytics
- 🧱 **Blocks** - Latest block data and metadata

### Modern Infrastructure
- 🐳 **Docker containers** with proper volume mounting
- 🔒 **HTTPS via NGINX** with Cloudflare SSL certificates
- 🎨 **React dashboard** with L1BEAT INDEXER branding
- 📡 **Auto-generated SDK** from OpenAPI specification

## 🌐 Access Points

After deployment:
- **Dashboard**: `https://your-domain.com/`
- **API Docs**: `https://your-domain.com/api/docs`
- **OpenAPI**: `https://your-domain.com/api/openapi.json`

## 🔧 Management Commands

```bash
# View deployment status
./deploy.sh --status

# View logs
./deploy.sh --logs

# Stop services
./deploy.sh --stop

# Full redeploy
git pull && ./deploy.sh

# Manual container management
docker-compose ps                    # Check status
docker-compose logs -f api          # View API logs
docker-compose restart api          # Restart API
docker-compose down                  # Stop all
```

## 🚨 Troubleshooting

### Common Issues

**SSL Certificate Missing**
```bash
# Ensure certificates exist
ls -la ~/certs/
# Should contain: cloudflare-origin.pem, cloudflare-origin.key, nginx.conf
```

**Node.js Version Too Old**
```bash
# Update Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Frontend Build Fails**
```bash
# Check if API is running first
curl http://localhost:80/api/chains

# If API is down, check logs
docker-compose logs api
```

**Volume Mounting Issues**
```bash
# Ensure you're in the correct directory
pwd  # Should show: /path/to/L1BEAT-INDEXER

# Check file permissions
ls -la frontend/dist/
```

### Manual Recovery

If deployment fails, you can recover manually:

```bash
# 1. Stop everything
docker-compose down

# 2. Start backend only
sed -i 's|frontend/dist:/assets|# frontend/dist:/assets|' compose.yml
docker-compose up -d

# 3. Build frontend
cd frontend && npm install && npm run openapi && npm run build && cd ..

# 4. Enable frontend
sed -i 's|# frontend/dist:/assets|frontend/dist:/assets|' compose.yml
docker-compose restart api
```

## 📈 Performance & Monitoring

### Resource Usage
- **Memory**: ~2GB for full stack
- **Storage**: ~1GB + blockchain data growth
- **CPU**: Low during sync, moderate during indexing

### Monitoring Endpoints
```bash
# Health checks
curl -s https://localhost/api/chains          # Chain status
curl -s https://localhost/api/43114/stats/tps # Chain metrics

# Docker monitoring
docker stats                                  # Resource usage
docker-compose logs -f                       # Live logs
```

## 🔄 Update Workflow

### Regular Updates
```bash
# Pull latest code and redeploy
git pull origin main
./deploy.sh
```

### Configuration Changes
```bash
# After modifying compose.yml, data/chains.json, or plugins/
./deploy.sh
```

### Frontend Only Updates
```bash
# If you only changed frontend code
cd frontend
npm run build
cd ..
docker-compose restart api
```

## 🛡️ Security Considerations

- 🔒 SSL certificates should be properly secured
- 🚫 Never commit certificates to Git
- 🔐 Use environment variables for sensitive data
- 🌐 Configure firewall rules for production
- 📝 Regular backups of data directory

## 📚 Development vs Production

### Development
```bash
# Local development with hot reload
cd frontend
npm run dev  # Frontend dev server on :5173

# In another terminal
docker-compose up api  # Backend only
```

### Production
```bash
# Full deployment with built assets
./deploy.sh
```

---

## 💡 Pro Tips

1. **Monitor logs during first deployment**: `./deploy.sh --logs`
2. **Backup your data directory** before major updates
3. **Test in development** before deploying to production
4. **Use deployment script options** for easier management
5. **Check SSL certificate expiry** regularly

**Need help?** Check the [main README](README.md) for more details about the L1BEAT INDEXER features and architecture.
