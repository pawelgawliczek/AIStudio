#!/bin/bash

#####################################################################
# Database Backup Cron Job Setup Script
# ST-70: Database Schema Migration Strategy & Safeguards
#
# This script sets up automated daily database backups
#####################################################################

set -e

echo "📅 Setting up daily backup cron job for Vibe Studio..."

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.ts"
NODE_BIN="$(which node)"
NPX_BIN="$(which npx)"

# Cron schedule: 2 AM daily
CRON_SCHEDULE="0 2 * * *"

# Cron command
CRON_COMMAND="cd $PROJECT_ROOT && $NPX_BIN tsx $BACKUP_SCRIPT --type daily --auto 2>&1 | logger -t vibestudio-backup"

# Create cron entry
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

echo "Cron schedule: Daily at 2 AM"
echo "Backup script: $BACKUP_SCRIPT"
echo ""

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "vibestudio-backup"; then
  echo "⚠️  Backup cron job already exists. Removing old entry..."
  crontab -l 2>/dev/null | grep -v "vibestudio-backup" | crontab -
fi

# Add new cron entry
echo "➕ Adding backup cron job..."
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Daily backup cron job installed successfully!"
echo ""
echo "Backup schedule: Daily at 2:00 AM"
echo "Retention: 30 days for daily backups"
echo "Logs: Check system logs with 'journalctl -t vibestudio-backup'"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove: crontab -l | grep -v vibestudio-backup | crontab -"
echo ""
echo "Manual backup: npm run db:backup"
echo "List backups: npm run db:list-backups"
