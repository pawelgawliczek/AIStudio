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

# Copy built files from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing and API proxy
RUN echo 'upstream backend { \
    server test-backend:3000; \
} \
\
server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Enable gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
    \
    # Proxy API requests to backend \
    location /api/ { \
        proxy_pass http://backend/api/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_cache_bypass $http_upgrade; \
        proxy_read_timeout 300s; \
        proxy_connect_timeout 75s; \
    } \
    \
    # Proxy WebSocket connections to backend \
    location /socket.io/ { \
        proxy_pass http://backend/socket.io/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Cache static assets \
    location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA routing - fallback to index.html \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "OK"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.default

# Don't run as nginx user - permissions are too restrictive
# RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx
# USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
