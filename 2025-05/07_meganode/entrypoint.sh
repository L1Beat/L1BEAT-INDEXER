#!/bin/bash
set -exu

/app/starter

export $(cat /app/.env | xargs)

./avalanchego
