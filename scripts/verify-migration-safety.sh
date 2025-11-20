#!/bin/bash
# Pre-flight safety check for database migrations
# This script verifies that all prerequisites for safe migrations are met

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Database Migration Safety Pre-Flight Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Verify we're in the correct directory
echo "📍 Check 1: Verifying directory location..."
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" != "/opt/stack/AIStudio" ]]; then
    echo "❌ ERROR: Must run from /opt/stack/AIStudio root directory"
    echo "   Current directory: $CURRENT_DIR"
    echo "   Required directory: /opt/stack/AIStudio"
    echo ""
    echo "   Fix: cd /opt/stack/AIStudio"
    exit 1
fi
echo "✅ Correct directory: $CURRENT_DIR"
echo ""

# Check 2: Verify package.json exists
echo "📦 Check 2: Verifying package.json exists..."
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: package.json not found in current directory"
    exit 1
fi
echo "✅ package.json found"
echo ""

# Check 3: Verify safe migration scripts exist
echo "🛡️  Check 3: Verifying safe migration system..."
if ! grep -q "migrate:safe" package.json; then
    echo "❌ ERROR: Safe migration scripts not found in package.json"
    echo ""
    echo "   The following scripts are missing:"
    echo "   • migrate:safe"
    echo "   • migrate:safe:dry-run"
    echo "   • db:backup"
    echo "   • db:restore"
    echo ""
    echo "   ⚠️  ST-70 (Database Schema Migration Strategy) must be implemented first"
    echo ""
    echo "   DO NOT proceed with migrations until the safe migration system is available."
    exit 1
fi
echo "✅ Safe migration system detected"
echo ""

# Check 4: Verify backup directory exists or can be created
echo "💾 Check 4: Verifying backup directory..."
BACKUP_DIR="/opt/stack/AIStudio/backup/db"
if [ ! -d "$BACKUP_DIR" ]; then
    echo "⚠️  Backup directory does not exist: $BACKUP_DIR"
    echo "   Attempting to create..."
    mkdir -p "$BACKUP_DIR" 2>/dev/null || {
        echo "❌ ERROR: Cannot create backup directory"
        echo "   Check permissions and disk space"
        exit 1
    }
    echo "✅ Backup directory created: $BACKUP_DIR"
else
    echo "✅ Backup directory exists: $BACKUP_DIR"
fi
echo ""

# Check 5: Verify sufficient disk space
echo "💿 Check 5: Verifying disk space..."
AVAILABLE_GB=$(df -BG /opt/stack/AIStudio | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_GB" -lt 5 ]; then
    echo "⚠️  WARNING: Low disk space detected"
    echo "   Available: ${AVAILABLE_GB}GB"
    echo "   Recommended: At least 5GB free for backups"
    echo ""
    echo "   Consider running: npm run db:cleanup"
else
    echo "✅ Sufficient disk space: ${AVAILABLE_GB}GB available"
fi
echo ""

# Check 6: Verify database connectivity
echo "🔌 Check 6: Verifying database connectivity..."
if docker ps | grep -q "vibe-studio-postgres"; then
    echo "✅ PostgreSQL container is running"
else
    echo "❌ ERROR: PostgreSQL container not running"
    echo "   Start with: docker compose up -d postgres"
    exit 1
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All pre-flight checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You can now safely run migrations:"
echo ""
echo "  Preview:  npm run migrate:safe:dry-run"
echo "  Execute:  npm run migrate:safe -- --story-id=ST-XX"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
