# Database Migration Runbook

## Overview

This runbook provides step-by-step procedures for safely executing database schema migrations in the Vibe Studio project.

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Standard Migration Procedure](#standard-migration-procedure)
3. [Dry-Run Preview](#dry-run-preview)
4. [Troubleshooting](#troubleshooting)
5. [Emergency Procedures](#emergency-procedures)

## Pre-Migration Checklist

Before running any migration, verify:

- [ ] **Schema changes reviewed**: PR approved by team
- [ ] **Local testing completed**: Migration tested on dev database
- [ ] **Breaking changes identified**: Used ST-42 schema detection
- [ ] **Backup directory accessible**: `/opt/stack/AIStudio/backups/` writable
- [ ] **Database accessible**: Can connect to PostgreSQL
- [ ] **No active queue lock**: No other migrations running
- [ ] **Sufficient disk space**: >10GB free for backups
- [ ] **Story ID available**: For tracking (e.g., ST-70)

## Standard Migration Procedure

### Step 1: Preview Migration (Dry Run)

Always preview migrations before applying:

```bash
npm run migrate:safe:dry-run
```

This shows:
- List of pending migrations
- SQL statements to be executed
- Estimated duration
- Risk assessment

### Step 2: Execute Safe Migration

Run the migration with all safeguards:

```bash
npm run migrate:safe
```

Or with story tracking:

```bash
npm run migrate:safe -- --story-id=ST-70
```

### Step 3: Monitor Progress

The migration will automatically:

1. ✅ **Pre-Flight Checks**: Verify prerequisites
2. ✅ **Create Backup**: Timestamped backup in `/opt/stack/AIStudio/backups/`
3. ✅ **Verify Backup**: Check file integrity
4. ✅ **Acquire Lock**: Prevent concurrent operations
5. ✅ **Execute Migrations**: Apply schema changes
6. ✅ **Validate Schema**: Verify tables, indexes, constraints
7. ✅ **Validate Data**: Check data integrity
8. ✅ **Health Checks**: Test application connectivity
9. ✅ **Smoke Tests**: Run critical operations
10. ✅ **Release Lock**: Allow other operations

### Step 4: Verify Success

Check for success message:

```
✅ Migration completed successfully!
Duration: 7.2s
Migrations Applied: 3
Backup: vibestudio_premig_20251119_143100_ST-70.dump
```

### Step 5: Monitor Application

After migration:
- Check application logs for errors
- Test critical user workflows
- Monitor database performance

## Dry-Run Preview

### When to Use Dry-Run

Use dry-run mode when:
- Reviewing migration impact before applying
- Planning complex migrations
- Estimating migration duration
- Identifying breaking changes

### How to Run

```bash
npm run migrate:safe:dry-run
```

### Example Output

```
=== DRY RUN MODE ===
The following migrations would be applied:
  1. 20251119_add_risk_score_to_stories
  2. 20251119_add_workflow_metadata
  3. 20251119_create_test_queue_locks
===================
```

## Troubleshooting

### Migration Fails: Backup Creation Error

**Symptom**: "Backup creation failed: No space left on device"

**Solution**:
1. Check disk space: `df -h /opt/stack/AIStudio/backups/`
2. Clean up old backups: `npm run db:cleanup`
3. Retry migration

### Migration Fails: Queue Already Locked

**Symptom**: "Queue is locked: ST-69 migration (expires at ...)"

**Solution**:
1. Wait for lock to expire (check expiry time)
2. Or check if lock can be released:
   ```bash
   # Check lock status
   ts-node -e "import {QueueLockService} from './backend/src/services/queue-lock.service'; const s = new QueueLockService(); s.checkLockStatus().then(console.log)"
   ```
3. If lock is stale, force unlock (use with caution):
   ```sql
   UPDATE test_queue_locks SET status='released' WHERE status='active';
   ```

### Validation Fails: Schema Mismatch

**Symptom**: "Validation failed! Triggering rollback..."

**Cause**: Migration succeeded but validation detected issues

**Solution**:
1. Automatic rollback will restore backup
2. Check validation errors in output
3. Fix migration locally
4. Test thoroughly before retrying

### Migration Timeout

**Symptom**: "Migration execution failed: timeout"

**Solution**:
1. Review migration complexity
2. Check for long-running queries
3. Consider splitting into multiple migrations
4. Increase timeout in config (if justified)

## Emergency Procedures

### Scenario 1: Migration Failed, Rollback Failed

**Symptoms**:
- Migration error
- Automatic rollback error
- Database in unknown state

**Recovery**:
1. **DO NOT PANIC** - backups exist
2. List available backups:
   ```bash
   npm run db:restore -- --list
   ```
3. Manually restore most recent backup:
   ```bash
   npm run db:restore -- --file=vibestudio_premig_TIMESTAMP_ST-XX.dump
   ```
4. Verify restoration:
   ```bash
   npm run db:validate
   ```

### Scenario 2: Need to Rollback After Successful Migration

**Use Case**: Migration succeeded but bug discovered later

**Procedure**:
1. Identify appropriate backup:
   ```bash
   npm run db:restore -- --list
   ```
2. Calculate data loss window (time between backup and now)
3. Get approval from team for rollback
4. Execute restore:
   ```bash
   npm run db:restore -- --file=BACKUP_FILE.dump
   ```
5. Confirm with "yes" when prompted
6. Document incident for post-mortem

### Scenario 3: Backup Corrupted

**Symptom**: "Backup verification failed: corrupted file"

**Prevention**:
- Daily automated backups provide fallback
- Backup verification runs after every backup

**Recovery**:
1. Use previous day's backup:
   ```bash
   npm run db:restore -- --file=vibestudio_daily_YYYYMMDD_020000.dump
   ```
2. Accept data loss for last 24 hours
3. Investigate backup corruption cause

## Best Practices

### DO ✅

- Always run dry-run first
- Associate migrations with story IDs
- Test migrations on staging before production
- Keep backups for full retention period
- Document breaking changes in migration files
- Monitor application after migrations

### DON'T ❌

- Never use `prisma db push --accept-data-loss` in production
- Never skip validation unless absolutely necessary
- Never delete backups manually without checking retention
- Never run concurrent migrations
- Never force-unlock queue without investigation

## Common Migration Patterns

### Pattern 1: Adding Nullable Column (Non-Breaking)

```prisma
model Story {
  // ... existing fields
  riskScore Int? // Nullable - safe to add
}
```

**Risk**: LOW
**Safeguards**: Standard
**Rollback**: Easy (drop column)

### Pattern 2: Adding Non-Null Column with Default (Semi-Breaking)

```prisma
model Story {
  // ... existing fields
  priority Int @default(5) // Has default - safer
}
```

**Risk**: MEDIUM
**Safeguards**: Full validation
**Rollback**: Easy (drop column)

### Pattern 3: Dropping Column (Breaking)

```prisma
model Story {
  // oldField removed
}
```

**Risk**: HIGH
**Safeguards**: Full validation + confirmation
**Rollback**: Requires backup (data loss)

**Recommendation**: Two-phase approach:
1. Phase 1: Make column nullable, stop using in code
2. Phase 2 (later): Drop column after confirmed unused

## Contact Information

- **On-Call Engineer**: Check PagerDuty
- **Database Admin**: [Contact info]
- **Escalation**: [Process]

## Revision History

- 2025-11-19: Initial version (ST-70)
