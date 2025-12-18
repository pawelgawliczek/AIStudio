# Operations

**Version:** 1.1
**Last Updated:** 2025-12-18
**Epic:** ST-279, ST-288

## Overview

Operations documentation covers deployment, infrastructure, and maintenance procedures for the AI Studio system. The system runs on Docker Compose with PostgreSQL, backend (NestJS), frontend (Next.js), and observability services (Grafana, Loki, Tempo, Alloy).

## Architecture

### Docker Compose Services

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Backend    │  │   Frontend   │      │
│  │  (Port 5432) │  │  (Port 3001) │  │ (Port 3000)  │      │
│  │              │  │              │  │              │      │
│  │  - Main DB   │  │  - NestJS    │  │  - Next.js   │      │
│  │  - pgvector  │  │  - MCP Server│  │  - React     │      │
│  │  - pg_trgm   │  │  - WebSocket │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Loki     │  │    Tempo     │  │   Grafana    │      │
│  │  (Port 3100) │  │  (Port 3200) │  │  (Port 3030) │      │
│  │              │  │              │  │              │      │
│  │  - Log store │  │  - Traces    │  │ - Dashboards │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│        ^                  ^                                 │
│        │                  │                                 │
│        └──────────────────┴──────────────────┐             │
│                                              │              │
│  ┌──────────────────────────────────────────▼─────┐        │
│  │              Alloy (v1.5.0)                    │        │
│  │       (Unified Telemetry Collector)            │        │
│  │  - Replaces Promtail v2.9.3                    │        │
│  │  - Collects logs, metrics, traces              │        │
│  └───────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS (443)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                        │
│  - SSL termination                                           │
│  - /api → backend:3001                                      │
│  - / → frontend:3000                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
        ▼                                  ▼
┌──────────────┐                  ┌──────────────┐
│   Backend    │◄─────────────────┤   Frontend   │
│  (Port 3001) │  Internal Network│  (Port 3000) │
└──────┬───────┘                  └──────────────┘
       │
       │ PostgreSQL connection
       ▼
┌──────────────┐
│  PostgreSQL  │
│  (Port 5432) │
└──────────────┘
```

## Deployment

### /deploy-backend Slash Command

Deploys backend service to production.

**Process:**
1. SSH to Hostinger VPS
2. Navigate to project directory
3. Pull latest changes from git
4. Rebuild backend Docker image
5. Restart backend container
6. Health check on port 3001

**Usage:**
```
/deploy-backend
```

**Files:**
- `.claude/commands/deploy-backend.md`
- SSH config: `~/.ssh/config` (alias: `hostinger`)

**Health Check:**
```bash
curl http://localhost:3001/health
```

### /deploy-frontend Slash Command

Deploys frontend service to production.

**Process:**
1. SSH to Hostinger VPS
2. Navigate to project directory
3. Pull latest changes from git
4. Rebuild frontend Docker image
5. Restart frontend container
6. Health check on port 3000

**Usage:**
```
/deploy-frontend
```

**Files:**
- `.claude/commands/deploy-frontend.md`

**Health Check:**
```bash
curl http://localhost:3000
```

### Manual Deployment

**Full stack rebuild:**
```bash
# SSH to production
ssh hostinger

# Navigate to project
cd /opt/stack/AIStudio

# Pull changes
git pull origin main

# Rebuild and restart all services
docker compose down
docker compose build --no-cache
docker compose up -d

# Check logs
docker compose logs -f
```

**Single service rebuild:**
```bash
# Rebuild backend only
docker compose build backend
docker compose up -d backend

# Rebuild frontend only
docker compose build frontend
docker compose up -d frontend
```

## Database Migrations

### Safe Migration Wrapper

**Always use safe wrapper from ROOT directory:**

```bash
cd /opt/stack/AIStudio
npm run migrate:safe -- --story-id=ST-XXX
```

**Wrapper handles:**
- Test queue locking
- Backup before migration
- Rollback on failure
- Story tracking

### Creating Migrations

```bash
cd /opt/stack/AIStudio/backend
npx prisma migrate dev --create-only --name <description>
```

**Example:**
```bash
npx prisma migrate dev --create-only --name add_cache_token_columns
```

**Review migration SQL before applying:**
```bash
cat backend/prisma/migrations/<timestamp>_add_cache_token_columns/migration.sql
```

### Migration Runbook

See: `docs/migrations/MIGRATION_RUNBOOK.md`

**Key steps:**
1. Create migration with `--create-only`
2. Review generated SQL
3. Test on local database first
4. Test on test database (port 5434)
5. Apply to production with safe wrapper
6. Verify migration success
7. Monitor application logs

## Infrastructure

### SSH Access

**Hostinger VPS:**
```bash
ssh hostinger
```

**NOT `ssh kvm`** - kvm alias is deprecated.

### Loki Log Queries

Use helper script for querying logs:

```bash
# Last 20 lines from backend
.claude/scripts/loki-query.sh '{compose_service="backend"}' 20

# Error logs only
.claude/scripts/loki-query.sh '{compose_service="backend"} |~ "error"' 50

# Frontend logs
.claude/scripts/loki-query.sh '{compose_service="frontend"}' 20
```

**Script handles:**
- Authentication to Loki
- Time range calculation
- JSON parsing and formatting

### Docker Compose Services

**Service list:**
```yaml
services:
  postgres:       # Main database
  backend:        # NestJS API + MCP server
  frontend:       # Next.js web app
  loki:           # Log aggregation (v3.3.0)
  tempo:          # Distributed tracing (v2.9.0)
  grafana:        # Observability dashboards (v12.3.0)
  alloy:          # Unified telemetry collector (v1.5.0, replaces Promtail v2.9.3)
```

**Common commands:**
```bash
# View all services
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart service
docker compose restart backend

# Check resource usage
docker stats
```

### Observability Stack

**Stack Overview (ST-288 - Upgraded 2025-12-18):**

| Service | Version | Purpose |
|---------|---------|---------|
| **Grafana** | 12.3.0 | Visualization and dashboards |
| **Loki** | 3.3.0 | Log aggregation with TSDB schema |
| **Tempo** | 2.9.0 | Distributed tracing backend |
| **Alloy** | 1.5.0 | Unified telemetry collector (replaces Promtail) |

**Key Changes:**
- Alloy v1.5.0 replaces Promtail v2.9.3 as unified collector for logs, metrics, and traces
- Loki upgraded to v3.3.0 with new TSDB schema (boltdb-shipper kept for backward compatibility)
- Tempo upgraded to v2.9.0 with improved search features (query_frontend enabled)
- Grafana upgraded to v12.3.0 with enhanced log panel support

**Accessing Observability Stack:**

```bash
# SSH tunnel to Grafana (port 3030)
ssh -L 3030:localhost:3030 hostinger

# Access dashboards
# URL: http://localhost:3030
# Credentials: admin / admin (or GRAFANA_ADMIN_PASSWORD)
```

**Query Endpoints:**

| Service | Endpoint | Port |
|---------|----------|------|
| Loki | http://loki:3100 | 3100 |
| Tempo | http://tempo:3200 | 3200 |
| Alloy | http://alloy:9090 | 9090 |
| Grafana | http://grafana:3030 | 3030 |

See `observability/README.md` for detailed instrumentation and query examples.

### Environment Variables

**Backend (.env):**
```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/aistudio
JWT_SECRET=<secret>
API_PORT=3001
NODE_ENV=production
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://backend:3001
NEXT_PUBLIC_WS_URL=ws://backend:3001
```

### Backup & Restore

**Database backup:**
```bash
# Backup
docker exec -t postgres pg_dump -U postgres aistudio > backup.sql

# Restore
docker exec -i postgres psql -U postgres aistudio < backup.sql
```

**Code backup:**
```bash
# Git is source of truth
git push origin main

# For safety, backup project directory
tar -czf aistudio-backup-$(date +%Y%m%d).tar.gz /opt/stack/AIStudio
```

## Monitoring

### Health Checks

**Backend:**
```bash
curl http://localhost:3001/health
# Expected: { "status": "ok", "database": "connected" }
```

**Frontend:**
```bash
curl http://localhost:3000
# Expected: HTML response
```

**PostgreSQL:**
```bash
docker exec postgres psql -U postgres -c "SELECT 1"
# Expected: 1 row
```

### Log Monitoring

**Real-time logs:**
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend | grep ERROR

# Loki query
.claude/scripts/loki-query.sh '{compose_service="backend"} |~ "ERROR|WARN"' 100
```

### Metrics

**Docker stats:**
```bash
docker stats --no-stream
```

**Database size:**
```sql
SELECT pg_size_pretty(pg_database_size('aistudio'));
```

**Disk usage:**
```bash
df -h
du -sh /opt/stack/AIStudio
```

## Troubleshooting

### Service won't start

**Symptom:** `docker compose up` fails for a service.

**Diagnosis:**
```bash
# Check logs
docker compose logs backend

# Check port conflicts
netstat -tuln | grep 3001

# Check image build
docker compose build backend
```

**Solution:**
- Review error message in logs
- Ensure environment variables are set
- Check for port conflicts
- Rebuild image if code changed

### Database connection error

**Symptom:** Backend logs show "database connection failed".

**Diagnosis:**
```bash
# Check postgres is running
docker compose ps postgres

# Check database connectivity
docker exec postgres psql -U postgres -c "SELECT 1"

# Check DATABASE_URL in backend
docker compose exec backend env | grep DATABASE_URL
```

**Solution:**
- Restart postgres: `docker compose restart postgres`
- Verify DATABASE_URL format
- Check postgres logs: `docker compose logs postgres`

### Migration failed

**Symptom:** `migrate:safe` command exits with error.

**Diagnosis:**
```bash
# Check migration status
cd backend && npx prisma migrate status

# Review migration SQL
cat backend/prisma/migrations/<latest>/migration.sql

# Check database schema
docker exec postgres psql -U postgres aistudio -c "\d"
```

**Solution:**
- Review migration SQL for syntax errors
- Check if migration already applied
- Manually rollback if needed (see Migration Runbook)
- Contact DBA if stuck

### Disk space full

**Symptom:** Services crashing, "no space left on device" errors.

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check Docker volumes
docker system df

# Find large files
du -sh /opt/stack/AIStudio/* | sort -h
```

**Solution:**
- Clean Docker: `docker system prune -a`
- Remove old logs: `find /var/log -type f -name "*.log" -mtime +30 -delete`
- Archive old transcripts
- Expand disk if needed

### SSL certificate expired

**Symptom:** Browser shows "Your connection is not private".

**Diagnosis:**
```bash
# Check certificate expiry
openssl x509 -in /etc/ssl/certs/aistudio.crt -noout -dates
```

**Solution:**
- Renew Let's Encrypt certificate
- Update nginx config
- Restart nginx

## References

- Deployment Runbook: `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md`
- Migration Runbook: `docs/migrations/MIGRATION_RUNBOOK.md`
- MCP Debug Guide: `docs/MCP_DEBUG_GUIDE.md`
- Remote Agent Setup: `docs/REMOTE_AGENT_GUIDE.md`
- ST-279: Living Documentation System

## Changelog

### Version 1.1 (2025-12-18)
- Added Observability Stack section (ST-288) with current service versions
- Updated architecture diagram to include Tempo, Grafana, and Alloy
- Updated service list with versions: Grafana 12.3.0, Loki 3.3.0, Tempo 2.9.0, Alloy v1.5.0
- Documented Alloy as replacement for Promtail with unified telemetry collection
- Added Observability Stack table with versions and purposes
- Added query endpoints reference for observability services

### Version 1.0 (2025-12-17)
- Initial documentation created for ST-279
- Documented Docker Compose services and network architecture
- Added deployment process for /deploy-backend and /deploy-frontend
- Documented database migration process and safe wrapper
- Added infrastructure details: SSH, Loki, environment variables
- Added monitoring and troubleshooting guides
