# Vibe Studio - Remote Host Deployment Guide

**Version:** 1.1
**Date:** 2025-11-11
**Purpose:** Deploy Vibe Studio to remote host with Caddy reverse proxy and MCP server integration

---

## Overview

This guide walks you through deploying Vibe Studio on a remote host where:
1. All services run in Docker containers
2. Caddy exposes the services via HTTPS
3. Claude Code (on the host) connects to the MCP server
4. You can continue development using the deployed system

---

## Prerequisites

### On Your Remote Host

- **OS:** Linux (Ubuntu 20.04+ or similar)
- **Docker:** 20.10+
- **Docker Compose:** 2.0+
- **Git:** 2.0+
- **Node.js:** 18+ (for MCP server CLI access)
- **Claude Code:** Already installed
- **Port Access:** Ports 80, 443, 5432, 6379, 3000, 5173 available
- **Domain (Optional):** For HTTPS via Caddy (or use IP with self-signed cert)

### Required Information

- Remote host IP or domain name
- SSH access to the remote host
- OpenAI API key (for embeddings feature)

---

## Phase 1: Initial Setup on Remote Host

### Step 1: SSH into Remote Host

```bash
ssh user@your-remote-host
```

### Step 2: Install Prerequisites (if not already installed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
docker --version
docker-compose --version
node --version
npm --version

# Log out and back in for docker group to take effect
exit
# Then SSH back in
```

### Step 3: Create Project Directory

```bash
# Choose your installation directory
mkdir -p ~/projects
cd ~/projects
```

---

## Phase 2: Clone and Configure Repository

### Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/pawelgawliczek/AIStudio.git
cd AIStudio

# Checkout the main branch
git checkout main
```

### Step 2: Create Production Environment Files

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
```

### Step 3: Configure Environment Variables

Edit `.env` for production:

```bash
nano .env
```

Update with production values:

```bash
# Database Configuration (use postgres service name from docker-compose)
DATABASE_URL="postgresql://postgres:your-secure-password@postgres:5432/vibestudio?schema=public"

# Redis Configuration
REDIS_URL="redis://redis:6379"

# JWT Configuration (GENERATE SECURE RANDOM STRINGS!)
JWT_SECRET="<generate-random-string-here>"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="<generate-another-random-string-here>"
JWT_REFRESH_EXPIRES_IN="7d"

# Server Configuration
NODE_ENV="production"
PORT=3000

# Frontend Configuration (use your domain or IP)
VITE_API_URL="https://your-domain.com/api"
VITE_WS_URL="wss://your-domain.com/api"

# MCP Server Configuration
MCP_LOG_LEVEL="info"

# Background Workers Configuration
BULL_CONCURRENCY=5
BULL_MAX_ATTEMPTS=3

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY="your-actual-openai-api-key"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
```

**Generate secure JWT secrets:**

```bash
# Generate random strings for JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_SECRET

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_REFRESH_SECRET
```

Edit `backend/.env` (similar to above, focused on backend):

```bash
nano backend/.env
```

```bash
DATABASE_URL="postgresql://postgres:your-secure-password@postgres:5432/vibestudio?schema=public"
REDIS_URL="redis://redis:6379"
JWT_SECRET="<same-as-above>"
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
PORT=3000
MCP_LOG_LEVEL="info"
OPENAI_API_KEY="your-actual-openai-api-key"
BULL_CONCURRENCY=5
```

---

## Phase 3: Create Production Docker Setup

### Step 1: Create Production docker-compose File

Create `docker-compose.prod.yml`:

```bash
nano docker-compose.prod.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: vibe-studio-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: vibestudio
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your-secure-password  # CHANGE THIS!
    ports:
      - '127.0.0.1:5432:5432'  # Only expose to localhost
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - aistudio-network

  redis:
    image: redis:7-alpine
    container_name: vibe-studio-redis
    restart: unless-stopped
    ports:
      - '127.0.0.1:6379:6379'  # Only expose to localhost
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - aistudio-network

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: vibe-studio-backend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:your-secure-password@postgres:5432/vibestudio?schema=public
      REDIS_URL: redis://redis:6379
    ports:
      - '127.0.0.1:3000:3000'  # Only expose to localhost (Caddy will proxy)
    volumes:
      - ./backend:/app/backend
      - ./shared:/app/shared
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - aistudio-network

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: vibe-studio-frontend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - '127.0.0.1:5173:5173'  # Only expose to localhost (Caddy will proxy)
    depends_on:
      - backend
    networks:
      - aistudio-network

  caddy:
    image: caddy:2-alpine
    container_name: vibe-studio-caddy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'  # For HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - aistudio-network
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  caddy_data:
    driver: local
  caddy_config:
    driver: local

networks:
  aistudio-network:
    driver: bridge
```

### Step 2: Create Production Dockerfiles

Create `backend/Dockerfile`:

```bash
nano backend/Dockerfile
```

```dockerfile
# Production Dockerfile for Backend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --production=false

# Copy source code
COPY backend ./backend
COPY shared ./shared
COPY tsconfig.json ./

# Generate Prisma Client
WORKDIR /app/backend
RUN npx prisma generate

# Build backend
WORKDIR /app
RUN npm run build:backend

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install production dependencies only
RUN npm ci --production

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/shared/dist ./shared/dist

# Generate Prisma Client in production
WORKDIR /app/backend
RUN npx prisma generate

WORKDIR /app

EXPOSE 3000

# Run migrations and start server
CMD cd backend && npx prisma migrate deploy && cd .. && node backend/dist/main.js
```

Create `frontend/Dockerfile`:

```bash
nano frontend/Dockerfile
```

```dockerfile
# Production Dockerfile for Frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend ./frontend
COPY shared ./shared
COPY tsconfig.json ./

# Build frontend
RUN npm run build:frontend

# Production stage - use nginx to serve static files
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
RUN echo 'server { \
    listen 5173; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
```

### Step 3: Create Caddyfile

```bash
nano Caddyfile
```

**For production with domain:**

```caddyfile
# Vibe Studio Caddy Configuration
# Replace your-domain.com with your actual domain

your-domain.com {
    # Frontend
    handle / {
        reverse_proxy frontend:5173
    }

    # API endpoints
    handle /api/* {
        reverse_proxy backend:3000
    }

    # WebSocket support
    handle /socket.io/* {
        reverse_proxy backend:3000
    }

    # Enable compression
    encode gzip

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Logs
    log {
        output file /data/access.log
    }
}
```

**For development/testing with IP (no domain):**

```caddyfile
# Vibe Studio Caddy Configuration (IP-based)

:80 {
    # Frontend
    handle / {
        reverse_proxy frontend:5173
    }

    # API endpoints
    handle /api/* {
        reverse_proxy backend:3000
    }

    # WebSocket support
    handle /socket.io/* {
        reverse_proxy backend:3000
    }

    # Enable compression
    encode gzip

    # Logs
    log {
        output file /data/access.log
    }
}
```

---

## Phase 4: Build and Start Services

### Step 1: Install Dependencies

```bash
cd ~/projects/AIStudio  # Note: directory name may not be updated yet
npm install
```

### Step 2: Build Backend (for MCP)

```bash
npm run build:backend
```

### Step 3: Start Docker Services

```bash
# Start all services in detached mode
docker-compose -f docker-compose.prod.yml up -d --build

# Watch the logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 4: Verify Services

```bash
# Check all containers are running
docker-compose -f docker-compose.prod.yml ps

# Should see:
# - vibe-studio-postgres (healthy)
# - vibe-studio-redis (healthy)
# - vibe-studio-backend (up)
# - vibe-studio-frontend (up)
# - vibe-studio-caddy (up)
```

### Step 5: Run Database Migrations

```bash
# Migrations run automatically in the backend container
# But you can also run manually if needed:
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Step 6: Test the Deployment

```bash
# Test frontend (from your local machine)
curl http://your-remote-host/

# Test API
curl http://your-remote-host/api/health

# Or with domain
curl https://your-domain.com/
curl https://your-domain.com/api/health
```

---

## Phase 5: Configure Claude Code MCP Connection

### Step 1: Find Claude Code Config Location

On your remote host:

```bash
# Claude Code config is typically in:
# ~/.config/claude-code/config.json
# or
# ~/.claude/config.json

# Find it:
find ~ -name "config.json" -path "*claude*"
```

### Step 2: Configure MCP Server

Edit the Claude Code configuration:

```bash
nano ~/.config/claude-code/config.json
```

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "vibestudio": {
      "command": "node",
      "args": ["backend/dist/mcp/server.js"],
      "cwd": "/home/YOUR_USERNAME/projects/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:your-secure-password@localhost:5432/vibestudio?schema=public",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important notes:**
- Replace `YOUR_USERNAME` with your actual username
- Use `localhost:5432` because we're connecting from the host to Docker
- The database is exposed to localhost only for security

### Step 3: Test MCP Connection

```bash
# Restart Claude Code or start a new session
# Then in Claude Code, try:
# "Use the list_projects tool to show all projects"
```

You should see the MCP tools available in Claude Code.

---

## Phase 6: Development Workflow

### SSH into Host

```bash
ssh user@your-remote-host
cd ~/projects/AIStudio
```

### Start Claude Code Session

```bash
# If Claude Code is CLI-based:
claude-code

# The MCP server will automatically connect
```

### Make Changes

Using Claude Code with MCP tools, you can:

1. Create projects: `bootstrap_project`
2. Create epics and stories: `create_epic`, `create_story`
3. Track work: `update_story`, `get_story`
4. View code quality: `get_architect_insights`
5. Check test coverage: `get_use_case_coverage`

### Rebuild Containers After Code Changes

```bash
# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Or rebuild specific service
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Database Operations

```bash
# Access database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d aistudio

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed database
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed

# Prisma Studio (access at http://your-host:5555)
docker-compose -f docker-compose.prod.yml exec backend npx prisma studio
```

---

## Phase 7: Maintenance & Operations

### Backup Database

```bash
# Create backup directory
mkdir -p ~/backups

# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres vibestudio > ~/backups/vibestudio_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres vibestudio | gzip > ~/backups/vibestudio_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# Stop backend to prevent connections
docker-compose -f docker-compose.prod.yml stop backend

# Restore
cat ~/backups/vibestudio_20251110_120000.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres vibestudio

# Or with gzip
gunzip -c ~/backups/vibestudio_20251110_120000.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres vibestudio

# Start backend
docker-compose -f docker-compose.prod.yml start backend
```

### Update to Latest Code

```bash
# Pull latest changes
git pull origin claude/new-priority-feature-011CUzSn4wxupZiNX6iahb2V

# Rebuild and restart
npm install
npm run build:backend
docker-compose -f docker-compose.prod.yml up -d --build
```

### Monitor Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
df -h

# Logs size
du -sh /var/lib/docker/containers/*/
```

### Clean Up Old Data

```bash
# Remove unused Docker images
docker image prune -a

# Remove unused volumes (BE CAREFUL!)
docker volume prune

# Remove stopped containers
docker container prune
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check specific service
docker-compose -f docker-compose.prod.yml logs backend

# Check container status
docker-compose -f docker-compose.prod.yml ps
```

### Database Connection Errors

```bash
# Check postgres is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check postgres logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d vibestudio -c "SELECT version();"

# Check DATABASE_URL
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

### MCP Server Not Connecting

```bash
# Check backend is built
ls -la backend/dist/mcp/

# If not, build it:
npm run build:backend

# Check DATABASE_URL in Claude Code config points to localhost:5432
# Check postgres port is exposed to localhost
docker-compose -f docker-compose.prod.yml ps postgres

# Test MCP server manually
cd ~/projects/AIStudio
node backend/dist/mcp/server.js
```

### Caddy Not Serving

```bash
# Check Caddy logs
docker-compose -f docker-compose.prod.yml logs caddy

# Check Caddyfile syntax
docker-compose -f docker-compose.prod.yml exec caddy caddy validate --config /etc/caddy/Caddyfile

# Restart Caddy
docker-compose -f docker-compose.prod.yml restart caddy
```

### Frontend Not Loading

```bash
# Check frontend logs
docker-compose -f docker-compose.prod.yml logs frontend

# Check nginx inside frontend container
docker-compose -f docker-compose.prod.yml exec frontend nginx -t

# Check built files
docker-compose -f docker-compose.prod.yml exec frontend ls -la /usr/share/nginx/html/
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Or stop and start with limits
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

## Security Considerations

### Change Default Passwords

- PostgreSQL password in `docker-compose.prod.yml`
- JWT secrets in `.env`

### Firewall Rules

```bash
# Allow SSH, HTTP, HTTPS only
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSL/TLS

- Caddy automatically handles Let's Encrypt certificates if you use a domain
- For IP-based setup, consider using Caddy with self-signed certs

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

## Next Steps

1. ✅ Deploy to remote host
2. ✅ Configure Claude Code MCP connection
3. ✅ Test all MCP tools
4. ✅ Start using for development
5. Continue with Sprint 10 (Advanced Features)
6. Set up monitoring (Prometheus + Grafana)
7. Set up automated backups
8. Configure CI/CD for automated deployments

---

## Quick Reference Commands

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# Database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres vibestudio > backup.sql

# Access database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d vibestudio

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

---

**Document Version:** 1.1
**Last Updated:** 2025-11-11
**Author:** Vibe Studio Team
**Status:** Ready for Deployment
