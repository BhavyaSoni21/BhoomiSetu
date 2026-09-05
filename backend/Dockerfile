# Multi-stage build. Everything (npm install, build) happens in `builder`
# with build tools available, then the final image just copies the already-
# resolved node_modules + compiled dist across - no second `npm install` in
# the final stage, which would otherwise risk failing differently if native
# modules (sqlite3, sharp) can't find a prebuilt binary and no build tools
# are present. Trades a larger image for a build that doesn't depend on two
# separate install steps behaving identically.
FROM node:22-slim AS builder
WORKDIR /app

# sqlite3/sharp ship prebuilt binaries for most platforms, but this is a
# safety net in case npm falls back to compiling from source here.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# TypeORM's SQLite driver needs this directory to already exist if
# USE_SQLITE=true - harmless if the container is run against Postgres
# instead (the intended production path, see docker-compose.yml).
RUN mkdir -p data

EXPOSE 3000
# nest build preserves the src/ folder structure under dist/ (no custom
# nest-cli.json entryFile/sourceRoot override), so the compiled entry point
# is dist/src/main.js, not dist/main.js - verified against a real local
# build rather than assumed.
CMD ["node", "dist/src/main.js"]
