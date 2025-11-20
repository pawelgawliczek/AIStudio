# Database Rollback Guide

## Overview

This guide provides procedures for rolling back database migrations when issues are detected.

## When to Rollback

### Rollback Immediately If:

- ❌ **Data Corruption**: Data integrity checks fail
- ❌ **Application Errors**: Critical features broken
- ❌ **Performance Degradation**: Queries 10x slower
- ❌ **Schema Errors**: Missing tables/columns
- ❌ **User Impact**: Users reporting errors

### Investigate First If:

- ⚠️ **Minor Warnings**: Non-critical errors
- ⚠️ **Performance Slightly Slower**: <2x slowdown
- ⚠️ **Edge Case Bugs**: Affecting <1% of users
- ⚠️ **Cosmetic Issues**: UI glitches only

## Automatic Rollback

### How It Works

The safe migration system automatically rolls back if:

1. **Migration Execution Fails**: SQL error, timeout, constraint violation
2. **Schema Validation Fails**: Missing tables, indexes, or constraints
3. **Data Integrity Fails**: Row count mismatch, orphaned records
4. **Health Checks Fail**: Cannot connect or query database
5. **Smoke Tests Fail**: Critical operations broken

### Monitoring Automatic Rollback

When automatic rollback triggers:

```
❌ Validation failed! Triggering rollback...
Rolling back to backup: vibestudio_premig_20251119_143100_ST-70.dump
Restore completed successfully
✅ Database restored to pre-migration state
```

### Verification After Automatic Rollback

1. Check that database is accessible
2. Verify application is operational
3. Review error logs
4. Document issue for investigation

## Manual Rollback

### Step 1: Assess the Situation

Before rolling back manually:

1. **Identify the issue**:
   - What is broken?
   - How many users affected?
   - Is it getting worse?

2. **Check recent migrations**:
   ```bash
   npm run migrate:safe:dry-run
   ```

3. **Review application logs**:
   - Backend errors
   - Database errors
   - User reports

4. **Calculate data loss window**:
   - Backup timestamp
   - Current time
   - Changes that will be lost

### Step 2: List Available Backups

```bash
npm run db:restore -- --list
```

Example output:
```
Available backups:

1. vibestudio_premig_20251119_143100_ST-70.dump
   Type: premig
   Size: 1.2 GB
   Location: /opt/stack/AIStudio/backups/
   Context: ST-70

2. vibestudio_daily_20251119_020000.dump
   Type: daily
   Size: 1.1 GB
   Location: /opt/stack/AIStudio/backups/
```

### Step 3: Choose Appropriate Backup

**Pre-Migration Backup** (Recommended):
- Created immediately before migration
- Exact state before changes
- Minimal data loss

**Daily Backup**:
- Older snapshot
- More data loss
- Use if pre-migration backup corrupted

### Step 4: Execute Rollback

**With Confirmation Prompt:**
```bash
npm run db:restore -- --file=vibestudio_premig_20251119_143100_ST-70.dump
```

You will see:
```
⚠️  WARNING: This will restore the database to a previous state.
⚠️  All changes made after the backup was created will be LOST.

Backup file: vibestudio_premig_20251119_143100_ST-70.dump

Are you sure you want to continue? Type "yes" to proceed:
```

Type `yes` to proceed.

**Without Confirmation (Emergency):**
```bash
npm run db:restore -- --file=BACKUP_FILE.dump --force
```

### Step 5: Verify Rollback

After restore completes:

1. **Run validation**:
   ```bash
   npm run db:validate
   ```

2. **Check critical tables**:
   ```sql
   SELECT COUNT(*) FROM projects;
   SELECT COUNT(*) FROM stories;
   SELECT COUNT(*) FROM workflows;
   ```

3. **Test application**:
   - Can log in?
   - Can view projects?
   - Can create stories?

4. **Monitor logs**:
   - No database errors?
   - Application healthy?

## Rollback Decision Matrix

| Issue Severity | User Impact | Time Since Migration | Decision |
|----------------|-------------|----------------------|----------|
| Critical | >50% users | <1 hour | **ROLLBACK NOW** |
| Critical | <50% users | <1 hour | **ROLLBACK NOW** |
| Critical | Any | >4 hours | Evaluate data loss |
| High | >25% users | <2 hours | **ROLLBACK NOW** |
| High | <25% users | Any | Evaluate alternatives |
| Medium | >10% users | <1 hour | Consider rollback |
| Medium | <10% users | Any | Fix forward |
| Low | <5% users | Any | Fix forward |

## Troubleshooting Rollback Issues

### Issue 1: Restore Fails - Backup File Corrupted

**Error**: "Backup verification failed"

**Solution**:
1. Try daily backup instead:
   ```bash
   npm run db:restore -- --file=vibestudio_daily_YYYYMMDD_020000.dump
   ```
2. If all backups fail, escalate immediately

### Issue 2: Restore Fails - Insufficient Permissions

**Error**: "Permission denied"

**Solution**:
```bash
# Check file permissions
ls -la /opt/stack/AIStudio/backups/

# Fix if needed
sudo chown -R $USER:$USER /opt/stack/AIStudio/backups/
chmod 644 /opt/stack/AIStudio/backups/*.dump
```

### Issue 3: Restore Succeeds But App Still Broken

**Possible Causes**:
- Code changes incompatible with old schema
- Cache not cleared
- Connections not refreshed

**Solution**:
1. Restart application:
   ```bash
   docker compose restart backend
   ```
2. Clear Redis cache:
   ```bash
   docker compose exec redis redis-cli FLUSHALL
   ```
3. Regenerate Prisma Client:
   ```bash
   cd backend && npx prisma generate
   ```

### Issue 4: Partial Data Loss After Rollback

**Symptom**: Recent data missing

**Explanation**: Expected behavior - rollback restores to backup timestamp

**Mitigation**:
1. Document data loss window
2. Notify affected users
3. Check if data can be recovered from logs
4. Implement fix to prevent future issues

## Post-Rollback Procedures

### 1. Document the Incident

Create incident report with:
- **What happened**: Description of issue
- **When**: Timeline of events
- **Why rolled back**: Decision rationale
- **Data loss**: What was lost
- **Next steps**: How to prevent recurrence

### 2. Communicate

Notify:
- **Team**: Internal communication
- **Users**: If user-facing impact
- **Stakeholders**: If business impact

### 3. Investigate Root Cause

- Review migration code
- Check test coverage
- Identify gaps in validation
- Update migration to fix issue

### 4. Plan Fix

Options:
- **Fix and retry**: Correct migration, reapply
- **Split migration**: Break into smaller steps
- **Alternative approach**: Different schema design

### 5. Update Documentation

- Add to migration runbook
- Update troubleshooting section
- Document lessons learned

## Emergency Contact Information

If rollback fails or issues persist:

1. **Check logs**: `/opt/stack/AIStudio/logs/migrations/`
2. **Database admin**: [Contact]
3. **On-call engineer**: [PagerDuty]
4. **Escalation**: [Process]

## Prevention Best Practices

### Before Migration

- ✅ Test on staging environment
- ✅ Run dry-run preview
- ✅ Review breaking changes
- ✅ Have rollback plan ready
- ✅ Schedule during low-traffic window

### During Migration

- ✅ Monitor progress closely
- ✅ Check validation results
- ✅ Test critical workflows immediately
- ✅ Have team available for support

### After Migration

- ✅ Monitor application for 1 hour
- ✅ Check error rates
- ✅ Review performance metrics
- ✅ Document any issues
- ✅ Keep backups accessible

## Examples

### Example 1: Rollback After Breaking Change

**Situation**: Dropped column still referenced in code

**Timeline**:
- 14:30 - Migration deployed
- 14:35 - Users reporting 500 errors
- 14:37 - Decision to rollback
- 14:40 - Rollback initiated
- 14:52 - Rollback complete
- 14:53 - Application operational

**Data Loss**: 7 minutes (14:30-14:37)

**Lesson**: Update code before schema changes

### Example 2: Rollback After Performance Issue

**Situation**: Missing index causes slow queries

**Timeline**:
- 02:00 - Daily automated migration
- 08:00 - Users report slowness
- 08:15 - Investigation identifies missing index
- 08:20 - Decision: Fix forward (add index)
- 08:25 - Index added, performance restored

**No Rollback Needed**: Fixed forward

**Lesson**: Always validate indexes in migrations

## Revision History

- 2025-11-19: Initial version (ST-70)
