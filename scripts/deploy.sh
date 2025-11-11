#!/bin/bash

# Vibe Studio Deployment Script
# Version: 1.0
# Last Updated: 2025-11-11
#
# This script automates the deployment process for Vibe Studio on a remote host.
# It handles environment setup, Docker builds, and service startup.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    error "Please do not run this script as root"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

info "Vibe Studio Deployment Script"
info "Project directory: $PROJECT_DIR"
echo ""

# Step 1: Check prerequisites
info "Step 1/8: Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi
success "Docker is installed: $(docker --version)"

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
success "Docker Compose is installed: $(docker compose version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    warning "Node.js is not installed. MCP server will not work without Node.js."
else
    success "Node.js is installed: $(node --version)"
fi

# Check if user is in docker group
if ! groups | grep -q docker; then
    warning "Current user is not in the docker group. You may need sudo for Docker commands."
    warning "Run: sudo usermod -aG docker $USER && logout && login"
fi

echo ""

# Step 2: Check environment files
info "Step 2/8: Checking environment files..."

cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
    warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    warning "Please edit .env file with your production values!"
    warning "Run: nano .env"
    read -p "Press Enter after editing .env to continue..."
else
    success ".env file exists"
fi

if [ ! -f "backend/.env" ]; then
    warning "backend/.env file not found. Creating from backend/.env.example..."
    cp backend/.env.example backend/.env
    warning "Please edit backend/.env file with your production values!"
    warning "Run: nano backend/.env"
    read -p "Press Enter after editing backend/.env to continue..."
else
    success "backend/.env file exists"
fi

# Check for default passwords
if grep -q "CHANGE_THIS_PASSWORD" .env 2>/dev/null || grep -q "your-secure-password" .env 2>/dev/null; then
    error "Default passwords detected in .env file!"
    error "Please change all default passwords before deploying."
    exit 1
fi

echo ""

# Step 3: Install dependencies
info "Step 3/8: Installing dependencies..."

if [ ! -d "node_modules" ]; then
    npm install
    success "Dependencies installed"
else
    info "Dependencies already installed (skipping)"
fi

echo ""

# Step 4: Build backend for MCP server
info "Step 4/8: Building backend for MCP server..."

if [ ! -d "backend/dist" ]; then
    npm run build:backend
    success "Backend built successfully"
else
    info "Backend already built (to rebuild, run: npm run build:backend)"
fi

echo ""

# Step 5: Stop existing containers
info "Step 5/8: Stopping existing containers (if any)..."

if docker compose -f docker-compose.prod.yml ps -q 2>/dev/null | grep -q .; then
    docker compose -f docker-compose.prod.yml down
    success "Existing containers stopped"
else
    info "No existing containers found"
fi

echo ""

# Step 6: Build and start containers
info "Step 6/8: Building and starting Docker containers..."
info "This may take several minutes..."

docker compose -f docker-compose.prod.yml up -d --build

success "Docker containers started"

echo ""

# Step 7: Wait for services to be healthy
info "Step 7/8: Waiting for services to become healthy..."

MAX_WAIT=120  # 2 minutes
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Check if postgres is healthy
    if docker compose -f docker-compose.prod.yml ps postgres | grep -q "healthy"; then
        success "PostgreSQL is healthy"
        break
    fi

    info "Waiting for PostgreSQL to be ready... (${ELAPSED}s/${MAX_WAIT}s)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    error "PostgreSQL did not become healthy in time"
    error "Check logs: docker compose -f docker-compose.prod.yml logs postgres"
    exit 1
fi

# Wait a bit more for backend to start
info "Waiting for backend to start..."
sleep 10

# Check backend health
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    success "Backend is responding"
else
    warning "Backend health check failed. It may still be starting up."
fi

echo ""

# Step 8: Show deployment status
info "Step 8/8: Checking deployment status..."

docker compose -f docker-compose.prod.yml ps

echo ""
success "========================================"
success "Vibe Studio deployed successfully!"
success "========================================"
echo ""

info "Services:"
info "  - Frontend: http://localhost (or http://$(hostname -I | awk '{print $1}'))"
info "  - Backend API: http://localhost:3000"
info "  - PostgreSQL: localhost:5432 (localhost only)"
info "  - Redis: localhost:6379 (localhost only)"
echo ""

info "Next steps:"
info "  1. Test the frontend: curl http://localhost/"
info "  2. Test the API: curl http://localhost:3000/health"
info "  3. Configure Claude Code MCP server (see DEPLOYMENT_GUIDE.md)"
info "  4. View logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""

info "Useful commands:"
info "  - View logs: docker compose -f docker-compose.prod.yml logs -f"
info "  - Stop services: docker compose -f docker-compose.prod.yml down"
info "  - Restart services: docker compose -f docker-compose.prod.yml restart"
info "  - Access database: docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d vibestudio"
echo ""

info "For detailed instructions, see: DEPLOYMENT_GUIDE.md"
