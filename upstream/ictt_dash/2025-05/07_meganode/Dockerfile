FROM oven/bun:1 AS base

WORKDIR /app
COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY *.ts ./

RUN bun build ./starter.ts --compile --outfile ./starter
RUN chmod +x /app/starter


FROM avaplatform/subnet-evm_avalanchego:latest
COPY --from=base /app/starter /app/starter
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh 
ENTRYPOINT ["/entrypoint.sh"]
