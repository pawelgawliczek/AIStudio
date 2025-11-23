#!/bin/bash

###############################################################################
# Database Restore Script
#
# Usage:
#   ./scripts/restore-database.sh                    # List available backups
#   ./scripts/restore-database.sh <backup_file>      # Restore specific backup
#
# Features:
# - List available backups by environment
# - Checksum verification before restore
# - Interactive confirmation
# - Decompression and database restore
# - Database connection verification
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKUP_DIR="${PROJECT_ROOT}/backups"

###############################################################################
# Function: Print header
###############################################################################
print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║        Database Restore Script - ST-78                         ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

###############################################################################
# Function: Load environment
###############################################################################
load_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
        exit 1
    fi

    source "$ENV_FILE"

    # Extract database connection details
    if [ -z "${DATABASE_URL:-}" ]; then
        echo -e "${RED}Error: DATABASE_URL not found in .env file${NC}"
        exit 1
    fi

    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
}

###############################################################################
# Function: List available backups
###############################################################################
list_backups() {
    echo -e "${BLUE}Available backups:${NC}"
    echo ""

    FOUND_BACKUPS=0

    # List production backups
    if [ -d "${BACKUP_DIR}/production" ]; then
        PROD_BACKUPS=$(find "${BACKUP_DIR}/production" -name "*.sql.gz" -type f 2>/dev/null | sort -r || echo "")
        if [ -n "$PROD_BACKUPS" ]; then
            echo -e "${GREEN}Production backups:${NC}"
            echo "$PROD_BACKUPS" | while read -r backup; do
                FILENAME=$(basename "$backup")
                SIZE=$(stat -c%s "$backup" 2>/dev/null || stat -f%z "$backup" 2>/dev/null || echo "0")
                SIZE_MB=$((SIZE / 1024 / 1024))
                MODIFIED=$(stat -c "%y" "$backup" 2>/dev/null | cut -d'.' -f1 || stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || echo "Unknown")

                echo -e "  ${YELLOW}${FILENAME}${NC}"
                echo -e "    Size: ${SIZE_MB} MB"
                echo -e "    Modified: ${MODIFIED}"
                echo ""
                FOUND_BACKUPS=$((FOUND_BACKUPS + 1))
            done
        fi
    fi

    # List development backups
    if [ -d "${BACKUP_DIR}/development" ]; then
        DEV_BACKUPS=$(find "${BACKUP_DIR}/development" -name "*.sql.gz" -type f 2>/dev/null | sort -r || echo "")
        if [ -n "$DEV_BACKUPS" ]; then
            echo -e "${GREEN}Development backups:${NC}"
            echo "$DEV_BACKUPS" | while read -r backup; do
                FILENAME=$(basename "$backup")
                SIZE=$(stat -c%s "$backup" 2>/dev/null || stat -f%z "$backup" 2>/dev/null || echo "0")
                SIZE_MB=$((SIZE / 1024 / 1024))
                MODIFIED=$(stat -c "%y" "$backup" 2>/dev/null | cut -d'.' -f1 || stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || echo "Unknown")

                echo -e "  ${YELLOW}${FILENAME}${NC}"
                echo -e "    Size: ${SIZE_MB} MB"
                echo -e "    Modified: ${MODIFIED}"
                echo ""
                FOUND_BACKUPS=$((FOUND_BACKUPS + 1))
            done
        fi
    fi

    # List old-style backups in root
    ROOT_BACKUPS=$(find "${BACKUP_DIR}" -maxdepth 1 -name "*.sql.gz" -o -name "*.sql" -o -name "*.dump" 2>/dev/null | sort -r || echo "")
    if [ -n "$ROOT_BACKUPS" ]; then
        echo -e "${GREEN}Legacy backups:${NC}"
        echo "$ROOT_BACKUPS" | while read -r backup; do
            FILENAME=$(basename "$backup")
            SIZE=$(stat -c%s "$backup" 2>/dev/null || stat -f%z "$backup" 2>/dev/null || echo "0")
            SIZE_MB=$((SIZE / 1024 / 1024))
            MODIFIED=$(stat -c "%y" "$backup" 2>/dev/null | cut -d'.' -f1 || stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || echo "Unknown")

            echo -e "  ${YELLOW}${FILENAME}${NC}"
            echo -e "    Size: ${SIZE_MB} MB"
            echo -e "    Modified: ${MODIFIED}"
            echo ""
            FOUND_BACKUPS=$((FOUND_BACKUPS + 1))
        done
    fi

    if [ "$FOUND_BACKUPS" -eq 0 ]; then
        echo -e "${YELLOW}No backups found${NC}"
        echo ""
        echo "To create a backup, run:"
        echo -e "  ${GREEN}./scripts/backup-database.sh production${NC}"
        echo -e "  ${GREEN}./scripts/backup-database.sh development${NC}"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}To restore a backup, run:${NC}"
    echo -e "  ${GREEN}./scripts/restore-database.sh <backup_filename>${NC}"
    echo ""
}

###############################################################################
# Function: Find backup file
###############################################################################
find_backup_file() {
    local BACKUP_FILENAME="$1"
    local BACKUP_PATH=""

    # Check production directory
    if [ -f "${BACKUP_DIR}/production/${BACKUP_FILENAME}" ]; then
        BACKUP_PATH="${BACKUP_DIR}/production/${BACKUP_FILENAME}"
    # Check development directory
    elif [ -f "${BACKUP_DIR}/development/${BACKUP_FILENAME}" ]; then
        BACKUP_PATH="${BACKUP_DIR}/development/${BACKUP_FILENAME}"
    # Check root directory
    elif [ -f "${BACKUP_DIR}/${BACKUP_FILENAME}" ]; then
        BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
    else
        echo -e "${RED}Error: Backup file not found: ${BACKUP_FILENAME}${NC}"
        echo ""
        echo "Run without arguments to see available backups:"
        echo -e "  ${GREEN}./scripts/restore-database.sh${NC}"
        exit 1
    fi

    echo "$BACKUP_PATH"
}

###############################################################################
# Function: Verify checksum
###############################################################################
verify_checksum() {
    local BACKUP_PATH="$1"
    local CHECKSUM_FILE="${BACKUP_PATH}.md5"

    if [ ! -f "$CHECKSUM_FILE" ]; then
        echo -e "${YELLOW}Warning: No checksum file found, skipping verification${NC}"
        return 0
    fi

    echo -e "${BLUE}Verifying checksum...${NC}"

    EXPECTED_CHECKSUM=$(cat "$CHECKSUM_FILE" | awk '{print $1}')

    if command -v md5sum > /dev/null 2>&1; then
        ACTUAL_CHECKSUM=$(md5sum "$BACKUP_PATH" | awk '{print $1}')
    elif command -v md5 > /dev/null 2>&1; then
        ACTUAL_CHECKSUM=$(md5 -q "$BACKUP_PATH")
    else
        echo -e "${YELLOW}Warning: md5sum/md5 not found, skipping checksum verification${NC}"
        return 0
    fi

    if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
        echo -e "${RED}Error: Checksum mismatch!${NC}"
        echo -e "  Expected: ${EXPECTED_CHECKSUM}"
        echo -e "  Actual:   ${ACTUAL_CHECKSUM}"
        echo ""
        echo -e "${RED}The backup file may be corrupted. Aborting restore.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Checksum verified: ${ACTUAL_CHECKSUM}${NC}"
}

###############################################################################
# Function: Check database connectivity
###############################################################################
check_db_connectivity() {
    echo -e "${BLUE}Checking database connectivity...${NC}"

    # Check if Docker container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^vibe-studio-postgres$"; then
        echo -e "${RED}Error: Docker container 'vibe-studio-postgres' is not running${NC}"
        echo "Start the container with: docker compose up -d postgres"
        exit 1
    fi

    # Test database connection via Docker
    if docker exec vibe-studio-postgres psql -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}Error: Cannot connect to database inside container${NC}"
        echo "Container: vibe-studio-postgres"
        exit 1
    fi
}

###############################################################################
# Function: Confirm restore
###############################################################################
confirm_restore() {
    local BACKUP_FILENAME="$1"

    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                        WARNING                                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}This will DESTROY all data in the current database!${NC}"
    echo ""
    echo -e "${GREEN}Database:${NC} $DB_NAME"
    echo -e "${GREEN}Host:${NC} $DB_HOST:$DB_PORT"
    echo -e "${GREEN}Backup:${NC} $BACKUP_FILENAME"
    echo ""
    echo -e "${YELLOW}Are you sure you want to continue? (yes/no)${NC}"
    read -r CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${BLUE}Restore cancelled${NC}"
        exit 0
    fi

    echo ""
}

###############################################################################
# Function: Restore database
###############################################################################
restore_database() {
    local BACKUP_PATH="$1"

    echo -e "${BLUE}Restoring database...${NC}"

    START_TIME=$(date +%s)

    # Drop and recreate database via Docker
    echo -e "${YELLOW}Dropping existing database...${NC}"
    docker exec vibe-studio-postgres psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | grep -v "NOTICE" || true

    echo -e "${YELLOW}Creating fresh database...${NC}"
    docker exec vibe-studio-postgres psql -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE $DB_NAME;" 2>&1 | grep -v "NOTICE" || true

    # Restore from backup
    echo -e "${YELLOW}Restoring from backup...${NC}"

    if [[ "$BACKUP_PATH" == *.gz ]]; then
        # Compressed backup - decompress on host and pipe to Docker
        if gunzip -c "$BACKUP_PATH" | docker exec -i vibe-studio-postgres psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            echo -e "${GREEN}✓ Database restored successfully (${DURATION}s)${NC}"
        else
            echo -e "${RED}Error: Restore failed${NC}"
            exit 1
        fi
    elif [[ "$BACKUP_PATH" == *.dump ]]; then
        # Custom format backup - need to copy to container first
        TEMP_FILE="/tmp/$(basename "$BACKUP_PATH")"
        docker cp "$BACKUP_PATH" "vibe-studio-postgres:$TEMP_FILE"

        if docker exec vibe-studio-postgres pg_restore -U "$DB_USER" -d "$DB_NAME" "$TEMP_FILE" > /dev/null 2>&1; then
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            echo -e "${GREEN}✓ Database restored successfully (${DURATION}s)${NC}"

            # Clean up temp file
            docker exec vibe-studio-postgres rm -f "$TEMP_FILE"
        else
            echo -e "${RED}Error: Restore failed${NC}"
            docker exec vibe-studio-postgres rm -f "$TEMP_FILE"
            exit 1
        fi
    else
        # Plain SQL backup - pipe to Docker
        if cat "$BACKUP_PATH" | docker exec -i vibe-studio-postgres psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            echo -e "${GREEN}✓ Database restored successfully (${DURATION}s)${NC}"
        else
            echo -e "${RED}Error: Restore failed${NC}"
            exit 1
        fi
    fi
}

###############################################################################
# Function: Verify restore
###############################################################################
verify_restore() {
    echo -e "${BLUE}Verifying restore...${NC}"

    # Check if database exists and has tables via Docker
    TABLE_COUNT=$(docker exec vibe-studio-postgres psql -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Database verified: ${TABLE_COUNT} tables restored${NC}"
    else
        echo -e "${YELLOW}Warning: No tables found in restored database${NC}"
    fi
}

###############################################################################
# Main execution
###############################################################################
main() {
    print_header
    load_environment

    # If no argument provided, list backups
    if [ $# -eq 0 ]; then
        list_backups
        exit 0
    fi

    BACKUP_FILENAME="$1"

    # Find backup file
    BACKUP_PATH=$(find_backup_file "$BACKUP_FILENAME")

    echo -e "${GREEN}Backup found:${NC} $BACKUP_PATH"
    echo ""

    # Verify checksum
    verify_checksum "$BACKUP_PATH"

    # Check database connectivity
    check_db_connectivity

    # Confirm restore
    confirm_restore "$BACKUP_FILENAME"

    # Restore database
    restore_database "$BACKUP_PATH"

    # Verify restore
    verify_restore

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Restore Complete                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    exit 0
}

# Run main function
main "$@"
