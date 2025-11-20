# Automated Database Backups

**Story:** ST-70 - Database Schema Migration Strategy & Safeguards
**Component:** Daily Backup Automation
**Last Updated:** 2025-11-19

---

## Overview

The Vibe Studio system includes automated daily database backups to ensure data safety and enable disaster recovery. This document describes the automated backup system and how to manage it.

## Backup Schedule

- **Frequency:** Daily
- **Time:** 2:00 AM (server local time)
- **Retention:** 30 days
- **Type:** Full PostgreSQL dump (custom format)
- **Location:** `/opt/stack/AIStudio/backups/`

## Setup

### Initial Installation

Run the setup script once to install the cron job:

```bash
cd /opt/stack/AIStudio/backend/scripts
./setup-cron.sh
```

This will:
- Create a daily cron job at 2:00 AM
- Configure logging to system journal
- Set up 30-day retention policy

### Verification

Check that the cron job is installed:

```bash
crontab -l | grep vibestudio-backup
```

Expected output:
```
0 2 * * * cd /opt/stack/AIStudio && npx tsx backend/scripts/backup-database.ts --type daily --auto 2>&1 | logger -t vibestudio-backup
```

## Backup Types

The system creates three types of backups:

| Type | Retention | Naming Pattern | When Created |
|------|-----------|----------------|--------------|
| **Pre-Migration** | 7 days | `vibestudio_premig_YYYYMMDD_HHMMSS_ST-XX.dump` | Before every migration |
| **Daily** | 30 days | `vibestudio_daily_YYYYMMDD_HHMMSS_auto.dump` | 2:00 AM daily (cron) |
| **Manual** | 90 days | `vibestudio_manual_YYYYMMDD_HHMMSS_<context>.dump` | On-demand |

## Management

### List All Backups

```bash
npm run db:list-backups
```

### Create Manual Backup

```bash
npm run db:backup -- --context "before-major-change"
```

### Clean Up Old Backups

```bash
npm run db:cleanup
```

This removes:
- Pre-migration backups older than 7 days
- Daily backups older than 30 days
- Manual backups older than 90 days

### Check Backup Status

```bash
# View recent backup logs
journalctl -t vibestudio-backup -n 50

# View logs from last 24 hours
journalctl -t vibestudio-backup --since "24 hours ago"

# Check last backup
ls -lth /opt/stack/AIStudio/backups/ | head -5
```

## Monitoring

### Email Alerts (Optional)

To receive email alerts for backup failures, configure SMTP settings and update the cron job:

```bash
# Edit crontab
crontab -e

# Modify to include email notification on error
0 2 * * * cd /opt/stack/AIStudio && npx tsx backend/scripts/backup-database.ts --type daily --auto 2>&1 | logger -t vibestudio-backup || echo "Backup failed" | mail -s "Vibe Studio Backup Failed" admin@example.com
```

### Disk Space Monitoring

Monitor backup directory disk usage:

```bash
# Check backup directory size
du -sh /opt/stack/AIStudio/backups/

# Check available disk space
df -h /opt/stack/AIStudio
```

**Recommended:** Set up alerts when disk usage exceeds 80%.

## Disaster Recovery

### Full System Recovery

1. Stop the application
2. Restore database from backup
3. Restart application

```bash
# Stop services
docker compose down

# Restore database
npm run db:restore -- --file vibestudio_daily_20251119_020000_auto.dump

# Restart services
docker compose up -d

# Verify
npm run db:validate
```

### Partial Recovery

To recover specific tables or data:

```bash
# Extract specific table from backup
docker exec vibe-studio-postgres pg_restore \
  -U postgres \
  -d vibestudio \
  -t stories \
  /backups/vibestudio_daily_20251119_020000_auto.dump
```

## Backup Verification

Backups are automatically verified after creation:

1. **File Size Check:** Ensures backup is > 1KB
2. **Restore Test:** Tests pg_restore with `--list` option
3. **Metadata Validation:** Verifies backup metadata file

To manually verify a backup:

```bash
# Test restore (dry-run)
docker exec vibe-studio-postgres pg_restore \
  --list \
  /backups/vibestudio_daily_20251119_020000_auto.dump

# Check backup metadata
cat /opt/stack/AIStudio/backups/vibestudio_daily_20251119_020000_auto.json
```

## Troubleshooting

### Backup Not Running

1. Check cron job exists:
   ```bash
   crontab -l | grep vibestudio-backup
   ```

2. Check cron service is running:
   ```bash
   systemctl status cron  # Ubuntu/Debian
   systemctl status crond # CentOS/RHEL
   ```

3. Check logs:
   ```bash
   journalctl -t vibestudio-backup --since "1 week ago"
   ```

### Backup Failing

Common causes:

1. **Disk full:** Check `df -h`
2. **PostgreSQL container not running:** Check `docker ps`
3. **Permission issues:** Ensure `/opt/stack/AIStudio/backups/` is writable
4. **Database locked:** Check for long-running queries

Debug steps:

```bash
# Run backup manually
npm run db:backup

# Check Docker container logs
docker logs vibe-studio-postgres

# Check database connections
docker exec vibe-studio-postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### Backup File Corrupted

1. Try next most recent backup
2. Verify backup before restore:
   ```bash
   npm run db:verify -- --file <backup-file>
   ```

## Security

### Backup Encryption (Future Enhancement)

Currently, backups are stored unencrypted. For production:

1. Enable disk encryption on backup volume
2. Or encrypt backups with GPG:
   ```bash
   gpg --symmetric --cipher-algo AES256 backup.dump
   ```

### Access Control

Backup files contain sensitive data. Ensure:

- Backup directory has restricted permissions (750)
- Only authorized users can access `/opt/stack/AIStudio/backups/`
- Backups are excluded from public repositories (.gitignore)

## Best Practices

1. **Test Restores Regularly:** Monthly restore tests to staging
2. **Monitor Disk Space:** Alert at 80% capacity
3. **Off-site Backups:** Copy to remote storage weekly
4. **Document Recovery Time:** Know your RTO (target: <15 minutes)
5. **Keep Multiple Generations:** Don't delete all old backups at once

## Configuration

Backup settings are defined in `/opt/stack/AIStudio/backend/config/migration.config.ts`:

```typescript
backup: {
  directory: '/opt/stack/AIStudio/backups',
  retentionDays: {
    preMigration: 7,
    daily: 30,
    manual: 90,
  },
  minBackupSize: 1024, // 1KB
  verifyAfterCreate: true,
}
```

## Support

For backup issues:

1. Check logs: `journalctl -t vibestudio-backup`
2. Review documentation: `/docs/migrations/MIGRATION_RUNBOOK.md`
3. Manual restore guide: `/docs/migrations/ROLLBACK_GUIDE.md`
4. Report issues: Create ticket with backup logs attached
