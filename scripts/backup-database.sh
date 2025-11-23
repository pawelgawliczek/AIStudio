#!/bin/bash

###############################################################################
# Database Backup Script with Retention Policies
#
# Usage:
#   ./scripts/backup-database.sh production
#   ./scripts/backup-database.sh development
#   ./scripts/backup-database.sh development --story-key=ST-78
#
# Features:
# - Compressed SQL dumps with timestamps
# - MD5 checksum verification
# - Manifest file with metadata
# - Retention cleanup (count-based: keep last 5 backups)
# - Story-based backup naming for workflow integration
# - Disk space verification
# - Database connectivity checks
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-development}"
STORY_KEY=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Parse optional parameters
shift || true
while [ $# -gt 0 ]; do
    case "$1" in
        --story-key=*)
            STORY_KEY="${1#*=}"
            shift
            ;;
        *)
            echo -e "${RED}Error: Unknown parameter: $1${NC}"
            echo "Usage: $0 [production|development] [--story-key=ST-XX]"
            exit 1
            ;;
    esac
done

# Validate environment parameter
if [[ ! "$ENVIRONMENT" =~ ^(production|development)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Use 'production' or 'development'${NC}"
    echo "Usage: $0 [production|development] [--story-key=ST-XX]"
    exit 1
fi

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

source "$ENV_FILE"

# Extract database connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL not found in .env file${NC}"
    exit 1
fi

DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

# Backup configuration based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    BACKUP_DIR="${PROJECT_ROOT}/backups/production"
    RETENTION_COUNT=5  # Keep last 5 backups
else
    BACKUP_DIR="${PROJECT_ROOT}/backups/development"
    RETENTION_COUNT=5  # Keep last 5 backups
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp and filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -n "$STORY_KEY" ]; then
    BACKUP_FILE="vibestudio_${ENVIRONMENT}_${STORY_KEY}_${TIMESTAMP}.sql.gz"
else
    BACKUP_FILE="vibestudio_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"
fi
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
MANIFEST_FILE="${BACKUP_DIR}/manifest.json"

###############################################################################
# Function: Print header
###############################################################################
print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║        Database Backup Script - ST-78                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${GREEN}Environment:${NC} $ENVIRONMENT"
    echo -e "${GREEN}Database:${NC} $DB_NAME"
    echo -e "${GREEN}Host:${NC} $DB_HOST:$DB_PORT"
    echo -e "${GREEN}Backup Directory:${NC} $BACKUP_DIR"
    echo -e "${GREEN}Retention:${NC} Keep last $RETENTION_COUNT backups"
    if [ -n "$STORY_KEY" ]; then
        echo -e "${GREEN}Story Key:${NC} $STORY_KEY"
    fi
    echo ""
}

###############################################################################
# Function: Check disk space
###############################################################################
check_disk_space() {
    echo -e "${BLUE}[1/6] Checking disk space...${NC}"

    # Get available space in GB
    AVAILABLE_SPACE=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')

    if [ "$AVAILABLE_SPACE" -lt 10 ]; then
        echo -e "${YELLOW}Warning: Low disk space! Only ${AVAILABLE_SPACE}GB available${NC}"
        echo -e "${YELLOW}Consider cleaning up old backups or freeing disk space${NC}"
    else
        echo -e "${GREEN}✓ Disk space OK: ${AVAILABLE_SPACE}GB available${NC}"
    fi
}

###############################################################################
# Function: Check database connectivity
###############################################################################
check_db_connectivity() {
    echo -e "${BLUE}[2/6] Checking database connectivity...${NC}"

    # Check if Docker container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^vibe-studio-postgres$"; then
        echo -e "${RED}Error: Docker container 'vibe-studio-postgres' is not running${NC}"
        echo "Start the container with: docker compose up -d postgres"
        exit 1
    fi

    # Test database connection via Docker
    if docker exec vibe-studio-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}Error: Cannot connect to database inside container${NC}"
        echo "Container: vibe-studio-postgres"
        echo "Database: $DB_NAME"
        exit 1
    fi
}

###############################################################################
# Function: Create backup
###############################################################################
create_backup() {
    echo -e "${BLUE}[3/6] Creating backup...${NC}"

    START_TIME=$(date +%s)

    # Create compressed backup using pg_dump via Docker
    # Note: pg_dump output is piped to gzip on the host
    if docker exec vibe-studio-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --format=plain \
        | gzip > "$BACKUP_PATH" 2>/dev/null; then

        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))

        BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
        BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

        echo -e "${GREEN}✓ Backup created successfully${NC}"
        echo -e "  File: ${BACKUP_FILE}"
        echo -e "  Size: ${BACKUP_SIZE_MB} MB"
        echo -e "  Duration: ${DURATION}s"
    else
        echo -e "${RED}Error: Backup creation failed${NC}"
        exit 1
    fi
}

###############################################################################
# Function: Calculate checksum
###############################################################################
calculate_checksum() {
    echo -e "${BLUE}[4/6] Calculating MD5 checksum...${NC}"

    if command -v md5sum > /dev/null 2>&1; then
        MD5_CHECKSUM=$(md5sum "$BACKUP_PATH" | awk '{print $1}')
    elif command -v md5 > /dev/null 2>&1; then
        MD5_CHECKSUM=$(md5 -q "$BACKUP_PATH")
    else
        echo -e "${YELLOW}Warning: md5sum/md5 not found, skipping checksum${NC}"
        MD5_CHECKSUM="not_available"
    fi

    if [ "$MD5_CHECKSUM" != "not_available" ]; then
        echo -e "${GREEN}✓ Checksum: ${MD5_CHECKSUM}${NC}"

        # Save checksum to file
        echo "$MD5_CHECKSUM  $BACKUP_FILE" > "${BACKUP_PATH}.md5"
    fi
}

###############################################################################
# Function: Update manifest
###############################################################################
update_manifest() {
    echo -e "${BLUE}[5/6] Updating manifest...${NC}"

    # Get file size
    BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)

    # Create or update manifest file
    if [ ! -f "$MANIFEST_FILE" ]; then
        echo '{"backups":[]}' > "$MANIFEST_FILE"
    fi

    # Add backup entry to manifest
    TMP_MANIFEST=$(mktemp)

    cat "$MANIFEST_FILE" | jq \
        --arg filename "$BACKUP_FILE" \
        --arg timestamp "$TIMESTAMP" \
        --arg size "$BACKUP_SIZE" \
        --arg checksum "$MD5_CHECKSUM" \
        --arg env "$ENVIRONMENT" \
        --arg storykey "$STORY_KEY" \
        '.backups += [{
            "filename": $filename,
            "timestamp": $timestamp,
            "size": ($size | tonumber),
            "checksum": $checksum,
            "environment": $env,
            "story_key": $storykey,
            "created_at": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
        }]' > "$TMP_MANIFEST"

    mv "$TMP_MANIFEST" "$MANIFEST_FILE"

    echo -e "${GREEN}✓ Manifest updated${NC}"
}

###############################################################################
# Function: Cleanup old backups (count-based retention policy)
###############################################################################
cleanup_old_backups() {
    echo -e "${BLUE}[6/6] Cleaning up old backups (retention: keep last ${RETENTION_COUNT})...${NC}"

    DELETED_COUNT=0

    # Get all backups sorted by modification time (newest first)
    BACKUPS=($(ls -t "${BACKUP_DIR}"/vibestudio_${ENVIRONMENT}_*.sql.gz 2>/dev/null || true))
    BACKUP_COUNT=${#BACKUPS[@]}

    # Keep only the most recent RETENTION_COUNT backups
    if [ "$BACKUP_COUNT" -gt "$RETENTION_COUNT" ]; then
        # Delete backups beyond retention count
        for ((i=RETENTION_COUNT; i<BACKUP_COUNT; i++)); do
            backup="${BACKUPS[$i]}"
            BACKUP_FILENAME=$(basename "$backup")
            echo -e "${YELLOW}  Deleting old backup: ${BACKUP_FILENAME}${NC}"

            rm -f "$backup"
            rm -f "${backup}.md5"

            DELETED_COUNT=$((DELETED_COUNT + 1))

            # Remove from manifest
            TMP_MANIFEST=$(mktemp)
            cat "$MANIFEST_FILE" | jq \
                --arg filename "$BACKUP_FILENAME" \
                '.backups = [.backups[] | select(.filename != $filename)]' \
                > "$TMP_MANIFEST"
            mv "$TMP_MANIFEST" "$MANIFEST_FILE"
        done
    fi

    if [ "$DELETED_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Deleted $DELETED_COUNT old backup(s)${NC}"
    else
        echo -e "${GREEN}✓ No old backups to delete (${BACKUP_COUNT}/${RETENTION_COUNT} kept)${NC}"
    fi
}

###############################################################################
# Function: Print summary
###############################################################################
print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Backup Complete                             ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Backup File:${NC} ${BACKUP_FILE}"
    echo -e "${GREEN}Location:${NC} ${BACKUP_PATH}"
    echo -e "${GREEN}Checksum:${NC} ${MD5_CHECKSUM}"
    echo ""

    # Count total backups
    TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "vibestudio_${ENVIRONMENT}_*.sql.gz" | wc -l | tr -d ' ')
    echo -e "${GREEN}Total ${ENVIRONMENT} backups:${NC} ${TOTAL_BACKUPS}"
    echo ""
}

###############################################################################
# Main execution
###############################################################################
main() {
    print_header
    check_disk_space
    check_db_connectivity
    create_backup
    calculate_checksum
    update_manifest
    cleanup_old_backups
    print_summary

    exit 0
}

# Run main function
main
