#!/bin/bash

# Vibe Studio Database Migration Script
# Renames PostgreSQL database from 'aistudio' to 'vibestudio'
# Version: 1.0
# Last Updated: 2025-11-11

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

info "Vibe Studio Database Migration Script"
info "This script will rename the database from 'aistudio' to 'vibestudio'"
echo ""

# Step 1: Check if running with docker compose
if ! docker ps --format '{{.Names}}' | grep -q "vibe-studio-postgres"; then
    error "Vibe Studio PostgreSQL container is not running"
    error "Please start your containers first with: docker compose up -d postgres"
    exit 1
fi

POSTGRES_CONTAINER="vibe-studio-postgres"
success "Found PostgreSQL container: $POSTGRES_CONTAINER"
echo ""

# Step 2: Check if aistudio database exists
info "Checking if 'aistudio' database exists..."
if ! docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -qx aistudio; then
    error "'aistudio' database does not exist"
    error "Nothing to migrate"
    exit 1
fi
success "'aistudio' database found"
echo ""

# Step 3: Check if vibestudio database already exists
info "Checking if 'vibestudio' database already exists..."
if docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -qx vibestudio; then
    warning "'vibestudio' database already exists"
    read -p "Do you want to drop it and recreate? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        error "Migration cancelled"
        exit 1
    fi
    info "Dropping existing 'vibestudio' database..."
    docker exec $POSTGRES_CONTAINER psql -U postgres -c "DROP DATABASE vibestudio;"
    success "'vibestudio' database dropped"
fi
echo ""

# Step 4: Stop backend to prevent active connections
info "Stopping backend containers to close database connections..."
docker compose stop backend 2>/dev/null || docker compose -f docker-compose.prod.yml stop backend 2>/dev/null || true
sleep 2
success "Backend stopped"
echo ""

# Step 5: Terminate any remaining connections to aistudio database
info "Terminating remaining connections to 'aistudio' database..."
docker exec $POSTGRES_CONTAINER psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'aistudio' AND pid <> pg_backend_pid();"
success "Connections terminated"
echo ""

# Step 6: Create backup before renaming (just in case)
info "Creating backup of 'aistudio' database..."
BACKUP_FILE="aistudio_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec $POSTGRES_CONTAINER pg_dump -U postgres aistudio > "/tmp/$BACKUP_FILE"
success "Backup created: /tmp/$BACKUP_FILE"
echo ""

# Step 7: Rename the database
info "Renaming database from 'aistudio' to 'vibestudio'..."
docker exec $POSTGRES_CONTAINER psql -U postgres -c "ALTER DATABASE aistudio RENAME TO vibestudio;"
success "Database renamed successfully!"
echo ""

# Step 8: Verify the rename
info "Verifying database rename..."
if docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -qx vibestudio; then
    success "'vibestudio' database exists"
else
    error "Database rename verification failed"
    exit 1
fi

if docker exec $POSTGRES_CONTAINER psql -U postgres -lqt | cut -d \| -f 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -qx aistudio; then
    error "'aistudio' database still exists"
    exit 1
fi
success "Verified: 'aistudio' no longer exists"
echo ""

# Step 9: Show database info
info "Database information:"
docker exec $POSTGRES_CONTAINER psql -U postgres -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE datname = 'vibestudio';"
echo ""

success "========================================"
success "Database migration completed!"
success "========================================"
echo ""

info "Next steps:"
info "  1. Update your .env files with the new database name"
info "  2. Update DATABASE_URL to use 'vibestudio' instead of 'aistudio'"
info "  3. Restart your containers: docker-compose up -d"
info "  4. Verify the application works correctly"
echo ""

warning "The backup file is saved at: /tmp/$BACKUP_FILE"
warning "Keep this backup until you've verified everything works!"
echo ""
