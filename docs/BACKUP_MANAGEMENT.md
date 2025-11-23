# Database Backup Management - ST-78

Automated database backup system with retention policies, monitoring, and easy restore capabilities.

## Overview

This system provides:
- **Automated backups** with different schedules for production and development
- **Retention policies** to automatically clean up old backups
- **Health monitoring** with alerts for missing or stale backups
- **Easy restore** with checksum verification
- **MCP tool integration** for programmatic backup status checks

## Backup Schedules and Retention

### Production Backups

- **Schedule**: Daily at 2:00 AM
- **Retention**: 5 days (120 hours)
- **Storage**: `/opt/stack/AIStudio/backups/production/`

### Development Backups

- **Schedule**: Every 2 hours (8 AM - 10 PM)
- **Retention**: 1 day (24 hours)
- **Storage**: `/opt/stack/AIStudio/backups/development/`

## Manual Backup

### Create a Backup

```bash
# Development environment backup
./scripts/backup-database.sh development

# Production environment backup
./scripts/backup-database.sh production
```

### What the Script Does

1. **Check disk space** - Warns if less than 10GB available
2. **Verify database connectivity** - Ensures Docker container is running
3. **Create compressed backup** - Uses `pg_dump` piped to `gzip`
4. **Calculate MD5 checksum** - Creates `.md5` file for verification
5. **Update manifest** - JSON metadata file tracking all backups
6. **Cleanup old backups** - Deletes backups older than retention period

### Backup File Format

Backups are named with environment and timestamp:
```
vibestudio_<environment>_<YYYYMMDD_HHMMSS>.sql.gz
```

Example:
```
vibestudio_production_20251122_020000.sql.gz
```

## Restore from Backup

### List Available Backups

```bash
./scripts/restore-database.sh
```

This displays all backups organized by environment (production, development, legacy).

### Restore a Specific Backup

```bash
./scripts/restore-database.sh <backup_filename>
```

Example:
```bash
./scripts/restore-database.sh vibestudio_production_20251122_020000.sql.gz
```

### Restore Process

1. **Find backup** - Searches production, development, and root directories
2. **Verify checksum** - Ensures backup file is not corrupted
3. **Check database connection** - Verifies Docker container is running
4. **Interactive confirmation** - Requires typing "yes" to proceed
5. **Drop and recreate database** - **⚠️ DESTRUCTIVE OPERATION**
6. **Restore from backup** - Decompresses and applies backup
7. **Verify restore** - Counts tables to ensure restore succeeded

### ⚠️ Important Warnings

**Restore is a destructive operation!** It will:
- Drop the existing database
- Delete all current data
- Recreate the database from the backup

Always ensure:
- You have a recent backup before restoring
- You're restoring to the correct environment
- You've confirmed the backup file is valid

## Automated Backup Scheduling

### Setting Up Cron Jobs

**⚠️ NOT AUTOMATED YET - Manual Setup Required**

Add these entries to your crontab (`crontab -e`):

#### Production Backups (Daily at 2:00 AM)

```bash
0 2 * * * /opt/stack/AIStudio/scripts/backup-database.sh production >> /opt/stack/AIStudio/logs/backup-production.log 2>&1
```

#### Development Backups (Every 2 hours, 8 AM - 10 PM)

```bash
0 8-22/2 * * * /opt/stack/AIStudio/scripts/backup-database.sh development >> /opt/stack/AIStudio/logs/backup-development.log 2>&1
```

### Create Log Directory

```bash
mkdir -p /opt/stack/AIStudio/logs
```

## Backup Monitoring

### Automatic Health Checks

The `BackupMonitorService` runs automatically every 6 hours and checks:

- **Production**: Alerts if no backup in last 25 hours
- **Development**: Alerts if no backup in last 3 hours

Alerts are logged to the application logs.

### Manual Health Check via MCP

Use the MCP tool to check backup status programmatically:

```typescript
// Example: Check backup status
const status = await mcpClient.call('mcp__vibestudio__get_backup_status', {});

console.log(status);
// {
//   production: {
//     healthy: true,
//     lastBackupTime: "2025-11-22T02:00:00Z",
//     lastBackupFile: "vibestudio_production_20251122_020000.sql.gz",
//     hoursSinceLastBackup: 10.5,
//     backupCount: 5,
//     totalSizeMB: 1024,
//     alerts: []
//   },
//   development: {
//     healthy: true,
//     lastBackupTime: "2025-11-22T10:00:00Z",
//     lastBackupFile: "vibestudio_development_20251122_100000.sql.gz",
//     hoursSinceLastBackup: 1.5,
//     backupCount: 12,
//     totalSizeMB: 512,
//     alerts: []
//   },
//   overallHealth: true,
//   lastCheckTime: "2025-11-22T11:30:00Z"
// }
```

## Backup Manifest

Each environment maintains a `manifest.json` file with metadata:

```json
{
  "backups": [
    {
      "filename": "vibestudio_production_20251122_020000.sql.gz",
      "timestamp": "20251122_020000",
      "size": 1073741824,
      "checksum": "abc123...",
      "environment": "production",
      "created_at": "2025-11-22T02:00:00Z"
    }
  ]
}
```

## Disk Space Management

### Current Usage

Check backup directory sizes:

```bash
du -sh /opt/stack/AIStudio/backups/*
```

### Manual Cleanup

If disk space is low, you can manually delete old backups:

```bash
# List backups by age
find /opt/stack/AIStudio/backups -name "*.sql.gz" -mtime +7 -ls

# Delete backups older than 7 days
find /opt/stack/AIStudio/backups -name "*.sql.gz" -mtime +7 -delete
```

**Note**: Automatic cleanup is handled by retention policies.

## Troubleshooting

### "Docker container is not running"

**Solution**: Start the PostgreSQL container:
```bash
docker compose up -d postgres
```

### "Low disk space" warning

**Options**:
1. Clean up old backups manually
2. Adjust retention policies in scripts
3. Add more disk space
4. Move backups to external storage

### "Checksum mismatch" error

**Problem**: Backup file is corrupted

**Solutions**:
1. Try a different backup file
2. Re-create the backup
3. Check disk for errors

### Backup file is 0 MB

**Problem**: Database might be empty or backup failed silently

**Check**:
```bash
# Verify database has data
docker exec vibe-studio-postgres psql -U postgres -d vibestudio -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

## Best Practices

### Before Major Changes

Always create a manual backup before:
- Database schema migrations
- Major version upgrades
- Bulk data operations
- Production deployments

```bash
./scripts/backup-database.sh production
```

### Testing Backups

Periodically test restore process in development:

```bash
# Create backup
./scripts/backup-database.sh development

# Test restore
./scripts/restore-database.sh vibestudio_development_<timestamp>.sql.gz
```

### Off-site Backups

For critical production data, consider:
- Copying backups to cloud storage (S3, etc.)
- Setting up database replication
- Implementing point-in-time recovery

### Monitoring Alerts

Set up alerts when backups fail:
- Check application logs daily
- Monitor MCP tool responses
- Set up external monitoring (future enhancement)

## Security Considerations

### Backup File Permissions

Backup files may contain sensitive data. Ensure proper permissions:

```bash
chmod 600 /opt/stack/AIStudio/backups/**/*.sql.gz
```

### Encryption at Rest

For sensitive production data, consider encrypting backups:

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# Decrypt for restore
gpg --decrypt backup.sql.gz.gpg | gunzip | docker exec -i vibe-studio-postgres psql -U postgres -d vibestudio
```

## Future Enhancements

Planned improvements (not yet implemented):

- [ ] Automated cron setup via systemd timers
- [ ] Cloud storage integration (S3, GCS)
- [ ] Slack/email notifications on backup failure
- [ ] Point-in-time recovery (PITR)
- [ ] Backup encryption by default
- [ ] Compression algorithm selection
- [ ] Incremental backups
- [ ] Database replication setup

## Related Documentation

- [Migration Runbook](/docs/migrations/MIGRATION_RUNBOOK.md) - Database migration procedures
- [Docker Setup](../README.md#docker) - Container configuration
- [MCP Tools](../backend/src/mcp/README.md) - Tool documentation

## Support

For issues or questions:
1. Check logs: `/opt/stack/AIStudio/logs/`
2. Verify Docker containers: `docker ps`
3. Review backup manifest: `cat backups/*/manifest.json | jq .`
4. Check disk space: `df -h`
