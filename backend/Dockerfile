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
RUN npm ci --include=dev

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

# Install dumb-init, OpenSSL for Prisma, git for code analysis, and build tools for native modules
RUN apk add --no-cache dumb-init openssl git python3 make g++

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install production dependencies only (rebuild native modules for Alpine)
RUN npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt --build-from-source

# Copy built files from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Generate Prisma Client in production image
WORKDIR /app/backend
RUN npx prisma generate

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Push schema and start server (use db push for fresh deployments, bypasses migrations)
CMD ["sh", "-c", "cd backend && npx prisma db push --accept-data-loss && cd .. && node backend/dist/main.js"]
