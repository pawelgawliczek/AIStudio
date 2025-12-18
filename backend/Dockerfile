# Production Dockerfile for Backend
# Multi-stage build for smaller image size

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install all dependencies (including devDependencies for build)
# ST-115: BuildKit cache mount for faster subsequent builds
# Using npm install instead of npm ci since lock files are not committed
# ST-291: Use legacy-peer-deps for NestJS 11 to handle peer dependency resolution
RUN --mount=type=cache,target=/root/.npm \
    npm install --include=dev --legacy-peer-deps

# Copy source code
COPY backend ./backend
COPY shared ./shared
COPY tsconfig.json ./

# Generate Prisma Client
WORKDIR /app/backend
RUN npx prisma generate

# Clean stale tsbuildinfo files before building
RUN rm -f tsconfig.*.tsbuildinfo

# Build TypeScript code (fail build if compilation errors)
WORKDIR /app/backend
RUN npx nest build
WORKDIR /app
RUN npm run build --workspace=shared

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Install dumb-init, OpenSSL for Prisma, git for code analysis, build tools for native modules,
# postgresql-client for backup operations (ST-130), docker-cli + docker-cli-compose for deployment (ST-195, ST-236),
# and openssh-client for git SSH operations (ST-236)
RUN apk add --no-cache dumb-init openssl git python3 make g++ postgresql-client docker-cli docker-cli-compose openssh-client

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install production dependencies only (rebuild native modules for Alpine)
# ST-115: BuildKit cache mount for faster subsequent builds
# Using npm install instead of npm ci since lock files are not committed
# ST-291: Use legacy-peer-deps for NestJS 11 to handle peer dependency resolution
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --ignore-scripts --legacy-peer-deps && npm rebuild bcrypt --build-from-source

# Copy built files from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# NOTE (ST-115): Prisma client already generated in builder stage (line 24) and copied above (line 55)
# No need to regenerate - removed redundant `npx prisma generate` that was adding 30-45s to builds

WORKDIR /app

# Create non-root user with docker group access for spawning Docker Runner (ST-195)
# Docker group GID 988 matches production server; adjust if needed via DOCKER_GID build arg
ARG DOCKER_GID=988
RUN addgroup -g ${DOCKER_GID} -S docker || true && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    adduser nodejs docker && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Deploy migrations safely (follows CLAUDE.md safe migration system)
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && cd .. && node backend/dist/main.js"]
