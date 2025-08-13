#!/bin/bash

docker pull avaplatform/subnet-evm_avalanchego:latest
docker build -t containerman17/subnet-evm-plus .
docker push containerman17/subnet-evm-plus
