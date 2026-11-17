# Build stage: prepare dependencies and build
FROM node:22-bookworm-slim AS build

# Install git (required for vault operations)
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

# Production stage: minimal runtime image
FROM node:22-bookworm-slim

# git for vault operations; an ssh client and CA certificates so git reaches a private remote over SSH or HTTPS
RUN apt-get update && \
    apt-get install -y --no-install-recommends git openssh-client ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Run as the image's built-in non-root `node` user (UID 1000); adding another UID 1000 user fails

WORKDIR /app

# Copy built application and dependencies from build stage
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server ./apps/server
COPY --from=build --chown=node:node /app/packages ./packages
# packages/markdown-yjs and packages/collab-client import shared code from the app's src/
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

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

# Run the server directly under node (same command as `pnpm server`), so node is PID 1 and gets SIGTERM
CMD ["node", "--experimental-strip-types", "apps/server/scripts/run.ts", "apps/server/src/main.ts"]
