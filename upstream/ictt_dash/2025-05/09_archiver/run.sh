#!/bin/bash

set -exu

docker buildx build -t containerman17/archiver-dev:latest .

docker run -e DATA_FOLDER="/data" -v $(pwd)/data:/data -it --rm --env-file .env containerman17/archiver-dev:latest
