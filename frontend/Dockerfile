# Production Dockerfile for Frontend
# Multi-stage build for smaller image size

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend ./frontend
COPY shared ./shared
COPY tsconfig.json ./

# Build arguments for environment variables
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/socket.io

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build frontend (skip TypeScript check for faster production build)
WORKDIR /app/frontend
RUN npx vite build

# Stage 2: Production - serve with nginx
FROM nginx:alpine

# Build argument for backend host (defaults to 'backend' for production)
ARG BACKEND_HOST=backend

# Copy built files from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration template and substitute backend host
COPY frontend/nginx.conf.template /tmp/nginx.conf.template
RUN sed "s/BACKEND_HOST_PLACEHOLDER/${BACKEND_HOST}/" /tmp/nginx.conf.template > /etc/nginx/conf.d/default.conf && \
    rm -f /tmp/nginx.conf.template /etc/nginx/conf.d/default.conf.default

# Don't run as nginx user - permissions are too restrictive
# RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx
# USER nginx

EXPOSE 80

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues in Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
