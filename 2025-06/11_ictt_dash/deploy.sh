#!/bin/bash

set -exu

# Master and slave addresses
MASTER_ADDRESS="idx6"
# SLAVE_ADDRESSES=("ubuntu@x.x.x.x")
SLAVE_ADDRESSES=()

# Pre-connect to all hosts to trigger YubiKey confirmations
echo "Pre-connecting to all hosts for YubiKey authentication..."
for host in "${SLAVE_ADDRESSES[@]}"; do
    echo "Connecting to slave: $host"
    ssh -o ConnectTimeout=10 $host exit || true
done
echo "Connecting to master: $MASTER_ADDRESS"
ssh -o ConnectTimeout=10 $MASTER_ADDRESS exit || true
echo "YubiKey authentication complete."
echo ""

updateMasterChainsJson() {
    local host=$1
    npx tsx ./scripts/updateChains.ts
    scp ./prod_chains.json $host:~/data/chains.json
}

updateReplicaChainsJson() {
    local host=$1
    ssh $host "curl -fsSL https://idx6.solokhin.com/api/replication/chains.json -o ~/data/chains.json"
}

updateAssets() {
    local host=$1
    #     npm run build
    rsync -av --delete ./dist/ $host:~/assets/
}

updatePlugins() {
    local host=$1
    # Ensure remote directories exist
    ssh $host "mkdir -p ~/data ~/plugins"
    # Sync local plugins to remote (removing any remote plugins not present locally)
    rsync -av --delete ./plugins/ $host:~/plugins/
}

updateCompose() {
    local host=$1
    scp ./compose.yml $host:~/compose.yml
}

restart() {
    local host=$1
    ssh -T $host << 'EOF'
# Run docker compose
cd ~
docker compose pull
docker compose up -d --remove-orphans
docker compose restart api fetcher indexer
EOF
}


# Single build for all hosts
npm run build

# First - update replica(s)
for HOST in "${SLAVE_ADDRESSES[@]}"; do
    echo "Updating slave: $HOST"
    updateReplicaChainsJson $HOST
    updateAssets $HOST
    updatePlugins $HOST
    updateCompose $HOST
    restart $HOST
done

# Then - update master
HOST="$MASTER_ADDRESS"
echo "Updating master: $HOST"
updateMasterChainsJson $HOST
updateAssets $HOST
updatePlugins $HOST
updateCompose $HOST
restart $HOST
