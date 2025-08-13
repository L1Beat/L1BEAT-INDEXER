#!/bin/bash

set -eu

source .env

# Add 1 for benchmarking node per cluster
TOTAL_INSTANCES=$((NUM_CLUSTERS * (NODES_PER_CLUSTER + 1)))

echo "NUM_CLUSTERS: $NUM_CLUSTERS"
echo "NODES_PER_CLUSTER: $NODES_PER_CLUSTER"
echo "TOTAL_INSTANCES: $TOTAL_INSTANCES"

terraform init

# Set default mode to apply if not specified
mode=${1:-apply}

if [ "$mode" == "apply" ]; then
    echo "Creating $NUM_CLUSTERS virtual clusters with $NODES_PER_CLUSTER nodes each (plus benchmark node)"
    echo "Total instances to create: $TOTAL_INSTANCES"
    
    terraform apply -auto-approve -parallelism=100 \
      -var="instance_count=${TOTAL_INSTANCES}"
    
    echo "All instances created successfully"
elif [ "$mode" == "destroy" ]; then
    echo "Destroying all instances..."
    
    terraform destroy -auto-approve -parallelism=100 \
      -var="instance_count=${TOTAL_INSTANCES}"
      
    echo "All instances destroyed successfully"
fi
