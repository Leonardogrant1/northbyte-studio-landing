# Multi-stage build for Cloud Run n8n-helpers
ARG NODE_VERSION=20
ARG PNPM_VERSION=10.28.1
ARG PROJECT=n8n-helpers

# Stage 1: Base - Setup pnpm and turbo
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Pin pnpm explicitly: without a package.json in this stage, corepack falls back
# to latest pnpm, and pnpm >= 11 requires Node 22+
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN npm install turbo --global
RUN pnpm config set store-dir ~/.pnpm-store

# Stage 2: Pruner - Isolate workspace with turbo prune
FROM base AS pruner
ARG PROJECT

WORKDIR /app
COPY . .
RUN turbo prune --scope=${PROJECT} --docker

# Stage 3: Builder - Install dependencies and build
FROM base AS builder
ARG PROJECT

WORKDIR /app

# Copy only what's needed: lockfile, workspace config, and full source tree
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/full/ .

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm install --frozen-lockfile

# Build with esbuild (creates single bundled index.js)
RUN cd cloud-run/${PROJECT} && pnpm build

# Stage 4: Runtime Base - Install ffmpeg
FROM node:${NODE_VERSION}-slim AS runtime-base

# Install ffmpeg and fonts for video processing and canvas
RUN apt-get update && \
    apt-get install -y \
        ffmpeg \
        fontconfig \
        fonts-liberation \
        fonts-dejavu-core \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Stage 5: Runner - Final production image
FROM runtime-base AS runner
ARG PROJECT

WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder --chown=node:node /app .

EXPOSE 8080

# Run as non-root user
USER node

WORKDIR /app/cloud-run/${PROJECT}

CMD ["node", "dist/index.js"]
