# ST-28 Deployment Runbook

**Story**: ST-28 - Fix Risk Score Formula Mismatch Between Worker and MCP Tool
**Priority**: Critical
**Deployment Type**: Database Migration + Code Deployment
**Estimated Downtime**: None (rolling deployment recommended)
**Rollback Strategy**: Database snapshot + Git revert

---

## 📋 Pre-Deployment Checklist

### Required Reviews
- [ ] Code review completed for commits:
  - `7763170` - Core formula fixes
  - `a6d4147` - Test expectation corrections
  - `76dbfce` - QA artifacts
- [ ] All tests passing locally
- [ ] Staging environment validated
- [ ] Deployment window scheduled
- [ ] Team notified of deployment

### Required Backups
- [ ] Database snapshot created
  ```bash
  # Create backup before migration
  pg_dump -h localhost -U postgres -d vibestudio -t code_metrics > code_metrics_backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Git branch tagged
  ```bash
  git tag -a st-28-pre-deploy -m "Pre-deployment snapshot for ST-28"
  git push origin st-28-pre-deploy
  ```

### Environment Verification
- [ ] Production database accessible
- [ ] Node.js version: 18+ (check with `node --version`)
- [ ] Prisma CLI available (check with `npx prisma --version`)
- [ ] Database connection string configured: `DATABASE_URL` environment variable

---

## 🚀 Deployment Steps

### Step 1: Prisma Client Generation

**Why**: Regenerate Prisma client to reflect schema.prisma documentation changes

**Command**:
```bash
cd /opt/stack/AIStudio/backend
DATABASE_URL='postgresql://postgres:361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518@127.0.0.1:5432/vibestudio?schema=public' npx prisma generate
```

**Expected Output**:
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 234ms
```

**Validation**:
```bash
# Verify Prisma client version
node -e "const { PrismaClient } = require('@prisma/client'); console.log('Prisma client loaded successfully');"
```

**Success Criteria**:
- ✅ No errors during generation
- ✅ Client loads without errors

**Troubleshooting**:
- Error: "Schema not found" → Check working directory is `/opt/stack/AIStudio/backend`
- Error: "Permission denied" → Check file permissions on prisma/ directory

---

### Step 2: Database Migration Script

**Why**: Recalculate all existing risk scores using the canonical formula

**Pre-Migration Verification**:
```bash
cd /opt/stack/AIStudio

# Count records to be migrated
psql -h localhost -U postgres -d vibestudio -c "SELECT COUNT(*) FROM code_metrics WHERE risk_score IS NOT NULL;"
```

**Dry Run (REQUIRED FIRST)**:
```bash
cd /opt/stack/AIStudio
npx tsx backend/src/scripts/migrate-risk-scores-st28.ts --dry-run
```

**Expected Dry Run Output**:
```
=== ST-28 Risk Score Migration (DRY RUN) ===

Project: Vibe Studio (345a29ee-d6ab-477d-8079-c5dda0844d77)
Records to migrate: 1,247

Sample changes (first 5):
┌─────────────────────────────────────────────────┬──────────┬─────────────┬───────────────┐
│ File Path                                       │ Old Risk │ New Risk    │ Change        │
├─────────────────────────────────────────────────┼──────────┼─────────────┼───────────────┤
│ backend/src/workers/processors/code-analysis... │ 45       │ 100         │ +55 (+122%)   │
│ backend/src/mcp/servers/code-quality/get_fi...  │ 32       │ 80          │ +48 (+150%)   │
│ frontend/src/components/Dashboard.tsx           │ 18       │ 36          │ +18 (+100%)   │
└─────────────────────────────────────────────────┴──────────┴─────────────┴───────────────┘

Statistics:
- Records with changes: 1,189 (95.4%)
- Records unchanged: 58 (4.6%)
- Average risk increase: +42% (expected for formula change)

DRY RUN COMPLETE - No changes made
```

**Execute Migration**:
```bash
cd /opt/stack/AIStudio
npx tsx backend/src/scripts/migrate-risk-scores-st28.ts
```

**Expected Live Output**:
```
=== ST-28 Risk Score Migration ===

⚠️  WARNING: This will update risk scores in the database
Continue? (yes/no): yes

Connecting to database...
✓ Connected successfully

Fetching records to migrate...
✓ Found 1,247 records across 1 project(s)

Migrating records (batch size: 100)...
Progress: [████████████████████████████████████████] 100% | 1247/1247 records | ETA: 0s

✓ Migration complete!

Summary:
- Total records processed: 1,247
- Records updated: 1,189
- Records skipped (unchanged): 58
- Errors: 0
- Duration: 8.3 seconds

Next steps:
1. Run validation script: npx tsx backend/src/scripts/validate-code-quality-metrics.ts
2. Invalidate caches (Redis + browser)
3. Monitor dashboard for 24 hours
```

**Validation Queries**:
```bash
# Check sample of updated records
psql -h localhost -U postgres -d vibestudio -c "
SELECT
  file_path,
  cyclomatic_complexity,
  churn_rate,
  maintainability_index,
  risk_score,
  ROUND((cyclomatic_complexity / 10.0) * churn_rate * (100 - maintainability_index)) as calculated_risk
FROM code_metrics
WHERE risk_score > 0
LIMIT 10;
"

# Verify formula consistency
psql -h localhost -U postgres -d vibestudio -c "
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN risk_score = LEAST(100, GREATEST(0, ROUND((cyclomatic_complexity / 10.0) * churn_rate * (100 - maintainability_index)))) THEN 1 END) as consistent_records,
  ROUND(100.0 * COUNT(CASE WHEN risk_score = LEAST(100, GREATEST(0, ROUND((cyclomatic_complexity / 10.0) * churn_rate * (100 - maintainability_index)))) THEN 1 END) / COUNT(*), 2) as consistency_pct
FROM code_metrics
WHERE risk_score IS NOT NULL;
"
```

**Success Criteria**:
- ✅ 95%+ records updated successfully
- ✅ No database errors
- ✅ Consistency validation shows 99%+ match
- ✅ No NULL risk scores for records with valid metrics

**Rollback Procedure** (if needed):
```bash
# Restore from backup
psql -h localhost -U postgres -d vibestudio < code_metrics_backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
psql -h localhost -U postgres -d vibestudio -c "SELECT COUNT(*) FROM code_metrics;"
```

---

### Step 3: ST-27 Validation Script

**Why**: Verify that risk score consistency has improved from 0% to 95%+

**Command**:
```bash
cd /opt/stack/AIStudio
npx tsx backend/src/scripts/validate-code-quality-metrics.ts
```

**Expected Output**:
```
=== ST-27: Code Quality Metrics Validation ===

Running validation for project: Vibe Studio (345a29ee-d6ab-477d-8079-c5dda0844d77)
Total files analyzed: 1,247

┌────────────────────────────────────────────────────────────────┐
│ 1. Schema Completeness                                         │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Files with all required metrics: 1,247/1,247 (100.0%)         │
│ Missing metrics: 0 files                                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 2. Risk Score Formula Consistency (ST-28 FIX)                  │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS (IMPROVED FROM 0%)                             │
│ Consistent risk scores: 1,235/1,247 (99.0%)                   │
│ Inconsistent: 12 files (0.96%)                                 │
│ Threshold: 95% (EXCEEDED)                                      │
│                                                                 │
│ Formula: round((complexity/10) × churn × (100-maintainability))│
│ Capped at [0, 100]                                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 3. Maintainability Index Bounds                                │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Valid range [0-100]: 1,247/1,247 (100.0%)                     │
│ Out of bounds: 0 files                                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 4. Cyclomatic Complexity Non-Negativity                        │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Non-negative values: 1,247/1,247 (100.0%)                     │
│ Negative values: 0 files                                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 5. Churn Rate Reasonableness                                   │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Reasonable churn [0-100]: 1,247/1,247 (100.0%)                │
│ Anomalies: 0 files                                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 6. Lines of Code Positivity                                    │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Positive LOC: 1,247/1,247 (100.0%)                            │
│ Zero/negative: 0 files                                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 7. Test Coverage Percentage Bounds                             │
├────────────────────────────────────────────────────────────────┤
│ Status: ✅ PASS                                                │
│ Valid range [0-100]: 1,247/1,247 (100.0%)                     │
│ Out of bounds: 0 files                                         │
└────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
OVERALL VALIDATION: ✅ PASS (7/7 criteria met)
═══════════════════════════════════════════════════════════════

Risk Score Consistency: 99.0% ✅ (Target: 95%, Previous: 0%)
Improvement: +99.0 percentage points

Validation completed at: 2025-11-18T14:35:22Z
Duration: 3.2 seconds
```

**Success Criteria**:
- ✅ Risk Score Consistency: 95%+ (previously 0%)
- ✅ Overall Validation: 7/7 criteria PASS
- ✅ No schema completeness issues
- ✅ All metrics within valid bounds

**Troubleshooting**:
- If consistency < 95%: Check for records with NULL metrics, investigate outliers
- If validation fails: Review migration logs, check for partial updates

---

### Step 4: Cache Invalidation

**Why**: Ensure users see updated risk scores immediately, not stale cached values

#### 4.1 Redis Cache Clear

**Command**:
```bash
# Connect to Redis
redis-cli -h 127.0.0.1 -p 6379

# Option 1: Clear all code quality caches (recommended)
redis-cli KEYS "code-quality:*" | xargs redis-cli DEL

# Option 2: Clear entire database (use with caution)
redis-cli FLUSHDB
```

**Expected Output**:
```
(integer) 247  # Number of keys deleted
```

**Verification**:
```bash
# Verify cache is empty
redis-cli KEYS "code-quality:*"
# Expected: (empty array)
```

#### 4.2 Application Cache Invalidation

**Backend Cache Clear** (if using in-memory cache):
```bash
# Restart backend services to clear in-memory caches
docker compose restart backend

# Or if using systemd
sudo systemctl restart vibestudio-backend
```

**Verification**:
```bash
# Check backend health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"2025-11-18T14:40:00Z"}
```

#### 4.3 Browser Cache Invalidation

**Option 1: Cache-Control Headers** (automatic):
```typescript
// Already implemented in backend
res.setHeader('Cache-Control', 'no-cache, must-revalidate');
res.setHeader('ETag', `st28-${Date.now()}`);
```

**Option 2: User Notification Banner**:
```tsx
// Add to frontend dashboard
<Banner type="info">
  Risk score metrics have been updated. Please refresh your browser (Ctrl+F5) to see the latest data.
</Banner>
```

**Option 3: Version Bump**:
```bash
# Update frontend version to force cache invalidation
cd /opt/stack/AIStudio/frontend
npm version patch
npm run build
```

#### 4.4 CDN Cache Purge (if applicable)

**CloudFlare Example**:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://vibestudio.example.com/api/code-quality/*"]}'
```

**Success Criteria**:
- ✅ Redis cache cleared (0 code-quality keys)
- ✅ Backend services restarted
- ✅ User notification visible on dashboard
- ✅ CDN cache purged (if applicable)

---

## 🧪 Post-Deployment Validation

### Immediate Checks (0-15 minutes)

**1. API Health Check**:
```bash
# Check backend is responding
curl http://localhost:3000/api/code-quality/health
```

**2. Sample File Risk Score Verification**:
```bash
# Use MCP tool to verify risk score retrieval
curl -X POST http://localhost:3000/api/mcp/code-quality/get_file_health \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "345a29ee-d6ab-477d-8079-c5dda0844d77",
    "filePath": "backend/src/workers/processors/code-analysis.processor.ts"
  }'
```

**Expected Response**:
```json
{
  "filePath": "backend/src/workers/processors/code-analysis.processor.ts",
  "riskScore": 100,
  "riskLevel": "critical",
  "cyclomaticComplexity": 20,
  "churnRate": 5.0,
  "maintainabilityIndex": 60.0,
  "insights": [
    "Critical risk file requiring immediate attention"
  ]
}
```

**3. Dashboard Hotspot Verification**:
- Navigate to: `http://localhost:5173/projects/345a29ee-d6ab-477d-8079-c5dda0844d77/health`
- Verify hotspots list shows updated risk scores
- Check for consistency with database values

**4. Database Consistency Check**:
```bash
# Run quick consistency check
psql -h localhost -U postgres -d vibestudio -c "
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN risk_score > 60 THEN 1 END) as hotspots,
  ROUND(AVG(risk_score), 2) as avg_risk,
  MAX(risk_score) as max_risk
FROM code_metrics;
"
```

**Expected Results**:
```
 total | hotspots | avg_risk | max_risk
-------+----------+----------+----------
  1247 |      342 |    52.34 |      100
```

### Short-Term Monitoring (1-24 hours)

**Metrics to Monitor**:
- [ ] API response times for code-quality endpoints (should be < 200ms)
- [ ] Database query performance (should be unchanged)
- [ ] Error rates in application logs (should be 0 for risk score calculations)
- [ ] User feedback on dashboard accuracy
- [ ] Hotspot detection accuracy

**Automated Monitoring**:
```bash
# Set up cron job for daily validation
0 2 * * * cd /opt/stack/AIStudio && npx tsx backend/src/scripts/validate-code-quality-metrics.ts >> /var/log/st28-validation.log 2>&1
```

### Medium-Term Validation (1-2 weeks)

- [ ] Review architect feedback on new risk score distribution
- [ ] Analyze hotspot prioritization effectiveness
- [ ] Compare before/after metrics for decision-making impact
- [ ] Update API documentation with new formula
- [ ] Publish release notes for stakeholders

---

## 🔄 Rollback Plan

**Conditions for Rollback**:
- Critical errors in migration (>5% records failed)
- Performance degradation (API latency >500ms)
- Data integrity issues detected
- User-facing errors on dashboard

**Rollback Steps**:

1. **Stop Deployment**:
   ```bash
   # Prevent further changes
   git checkout main
   ```

2. **Restore Database**:
   ```bash
   # Restore from pre-deployment backup
   psql -h localhost -U postgres -d vibestudio < code_metrics_backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Revert Code Changes**:
   ```bash
   git revert 76dbfce a6d4147 7763170
   git push origin main
   ```

4. **Regenerate Prisma Client**:
   ```bash
   cd /opt/stack/AIStudio/backend
   npx prisma generate
   ```

5. **Restart Services**:
   ```bash
   docker compose restart backend
   ```

6. **Clear Caches**:
   ```bash
   redis-cli FLUSHDB
   ```

7. **Verify Rollback**:
   ```bash
   # Check old formula is restored
   psql -h localhost -U postgres -d vibestudio -c "SELECT file_path, risk_score FROM code_metrics LIMIT 5;"
   ```

**Rollback Success Criteria**:
- ✅ Database restored to pre-migration state
- ✅ Code reverted to previous commit
- ✅ Services operational
- ✅ No data loss

---

## 📝 Communication Plan

### Pre-Deployment Notification

**To**: Engineering Team, Product Managers, QA Team
**Subject**: ST-28 Deployment - Risk Score Formula Fix
**Message**:
```
📅 Deployment Date: [DATE] at [TIME]

We're deploying ST-28, a critical fix for risk score calculation consistency.

What's Changing:
- Risk score formula standardized across Worker and MCP Tool
- Existing risk scores will be recalculated (expect values to increase)
- No downtime expected

Expected Impact:
- Hotspot detection may show different files (more accurate)
- Risk scores will be consistent across dashboard and detail views
- Average risk score may increase by ~40%

Action Required:
- None for users
- QA: Verify hotspot accuracy after deployment
- Architects: Review new hotspot distribution

Questions? Contact: [YOUR NAME]
```

### Post-Deployment Notification

**To**: All Stakeholders
**Subject**: ✅ ST-28 Deployment Complete - Risk Scores Updated
**Message**:
```
Deployment Status: ✅ SUCCESS

Results:
- 1,247 risk scores recalculated
- 99% consistency achieved (target: 95%)
- All validation checks passed
- No errors or downtime

What to Expect:
- Risk scores are now consistent across all views
- Hotspot detection is more accurate
- You may see different files flagged as high-risk

Next Steps:
- Monitor for 24 hours
- Review hotspot distribution
- Provide feedback on accuracy

Release Notes: [LINK TO ST-28-QA-REPORT.md]
```

---

## 📚 Additional Resources

### Documentation Links
- ST-28 Story: `/opt/stack/AIStudio/stories/ST-28.md`
- QA Report: `/opt/stack/AIStudio/ST-28-QA-REPORT.md`
- Migration Script: `/opt/stack/AIStudio/backend/src/scripts/migrate-risk-scores-st28.ts`
- Validation Script: `/opt/stack/AIStudio/backend/src/scripts/validate-code-quality-metrics.ts`

### Test Files
- Unit Tests: `/opt/stack/AIStudio/backend/src/workers/processors/__tests__/code-analysis.processor.test.ts`
- E2E Tests: `/opt/stack/AIStudio/backend/src/workers/processors/__tests__/risk-score-e2e.test.ts`
- Integration Tests: `/opt/stack/AIStudio/backend/src/mcp/servers/code-quality/__tests__/get_file_health.test.ts`

### Database Schema
- Prisma Schema: `/opt/stack/AIStudio/backend/prisma/schema.prisma`
- CodeMetrics Model: Line 199-220

### Git Commits
- Core Fix: `7763170` - "fix(ST-28): Standardize risk score formula across Worker and MCP Tool"
- Test Fix: `a6d4147` - "fix(ST-28): Correct test expectations for risk score formula"
- QA Artifacts: `76dbfce` - "docs(ST-28): Add comprehensive QA report and integration tests"

---

## ✅ Deployment Checklist Summary

### Pre-Deployment
- [ ] Code review completed
- [ ] Tests passing locally
- [ ] Database backup created
- [ ] Git tag created
- [ ] Team notified
- [ ] Deployment window scheduled

### Deployment
- [ ] Prisma client generated
- [ ] Migration dry run executed
- [ ] Migration executed successfully
- [ ] Validation script shows 95%+ consistency
- [ ] Redis cache cleared
- [ ] Backend services restarted
- [ ] Browser cache invalidation notice posted
- [ ] CDN cache purged (if applicable)

### Post-Deployment
- [ ] API health check passed
- [ ] Sample file verification passed
- [ ] Dashboard hotspots updated
- [ ] Database consistency verified
- [ ] Monitoring alerts configured
- [ ] Post-deployment notification sent
- [ ] 24-hour monitoring period begins

### Sign-Off
- [ ] Deployment Engineer: ________________ Date: ______
- [ ] QA Lead: ________________ Date: ______
- [ ] Product Manager: ________________ Date: ______

---

## 🆘 Emergency Contacts

**Deployment Issues**:
- Primary: [YOUR NAME] - [EMAIL/PHONE]
- Backup: [BACKUP NAME] - [EMAIL/PHONE]

**Database Issues**:
- DBA: [DBA NAME] - [EMAIL/PHONE]

**On-Call**:
- PagerDuty: [ONCALL SCHEDULE LINK]

---

**Document Version**: 1.0
**Last Updated**: 2025-11-18
**Author**: Claude (ST-28 Workflow)
**Reviewed By**: [PENDING]
