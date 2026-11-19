# Build from the repository root: docker build -f apps/server/Dockerfile .
#
# Build stage: install the repository's dependencies, then bundle the server and the token
# command (apps/server/scripts/build-image.ts). Only the bundles and the few packages that
# cannot be bundled reach the runtime image.
FROM node:22-bookworm-slim AS build

# git, which install scripts (husky's prepare) may call
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy entire repository (filtered by .dockerignore)
# This includes all workspace packages and source code
COPY . .

# Enable pnpm and install dependencies
RUN corepack enable && \
    corepack prepare pnpm@10.33.0 --activate && \
    pnpm install --frozen-lockfile

# /out/dist: main.mjs and token.mjs with source maps; /out/node_modules: jsdom and its dependencies;
# /out/bin/tolaria-token: the token command's launcher
RUN node --experimental-strip-types apps/server/scripts/build-image.ts /out

# Production stage: Node, git and the bundles
FROM node:22-bookworm-slim

# git for vault operations; an ssh client and CA certificates so git reaches a private remote over SSH or HTTPS
RUN apt-get update && \
    apt-get install -y --no-install-recommends git openssh-client ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Run as the image's built-in non-root `node` user (UID 1000); adding another UID 1000 user fails

WORKDIR /app

# The code stays owned by root: the server only reads it
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/bin/tolaria-token /usr/local/bin/tolaria-token

# Create data directory with correct ownership
RUN mkdir -p /app/data && chown node:node /app/data

# Switch to non-root user
USER node

# Expose default port
EXPOSE 8787

# Set default environment variables
ENV TOLARIA_SERVER_DATA_DIR=/app/data \
    TOLARIA_SERVER_HOST=0.0.0.0 \
    TOLARIA_SERVER_PORT=8787 \
    TOLARIA_SERVER_ALLOW_NON_LOOPBACK=1 \
    NODE_ENV=production

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8787/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Run the prebuilt bundle directly under node, so node is PID 1 and gets SIGTERM.
# Stack traces name the original source files and lines through the source map.
CMD ["node", "--enable-source-maps", "dist/main.mjs"]
