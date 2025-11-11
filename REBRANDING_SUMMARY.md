# Vibe Studio Rebranding Summary

**Date:** 2025-11-11
**Status:** Ready for Database Migration

## Changes Made

### 1. Docker Compose Files

#### docker-compose.yml
- ✅ Container names updated:
  - `aistudio-postgres` → `vibe-studio-postgres`
  - `aistudio-redis` → `vibe-studio-redis`
  - `aistudio-backend` → `vibe-studio-backend`
  - `aistudio-frontend` → `vibe-studio-frontend`
- ✅ Database name updated: `aistudio` → `vibestudio`
- ⚠️  Network names kept as `aistudio-network` (to avoid breaking Caddy integration)

#### docker-compose.prod.yml
- ✅ Container names updated (same as above)
- ✅ Database name updated: `aistudio` → `vibestudio`
- ⚠️  Network names kept as `aistudio-network` (to avoid breaking Caddy integration)

### 2. Deployment Scripts

#### scripts/deploy.sh
- ✅ Updated all references from "AI Studio" to "Vibe Studio"
- ✅ Updated database access commands to use `vibestudio`
- ✅ Updated script headers and comments

#### scripts/rename-database.sh (NEW)
- ✅ Created migration script to rename PostgreSQL database
- ✅ Includes safety checks and automatic backup
- ✅ Made executable with proper permissions

### 3. Documentation

#### DEPLOYMENT_GUIDE.md
- ✅ Updated title from "AI Studio" to "Vibe Studio"
- ✅ Updated all container name references
- ✅ Updated all database name references
- ✅ Updated MCP server configuration examples
- ✅ Updated backup/restore commands
- ✅ Updated version to 1.1

## What Was NOT Changed

### Network Names
The following network names were **intentionally kept** to avoid breaking Caddy integration:
- `aistudio-network` - Internal network for service communication
- `stack_appnet` - External network used by Caddy (unchanged)

### Directory Structure
The project directory is still `/opt/stack/AIStudio` - this can be renamed separately if needed.

## Migration Steps Required

### Step 1: Stop All Services
```bash
docker compose down
# or
docker compose -f docker-compose.prod.yml down
```

**Note:** Use `docker compose` (with a space) not `docker-compose` (with a hyphen) for Docker Compose V2.

### Step 2: Backup Current Database (Optional but Recommended)
```bash
# Start only postgres to create backup
docker compose up -d postgres

# Wait for postgres to be ready
sleep 10

# Create backup
docker exec vibe-studio-postgres pg_dump -U postgres aistudio > /tmp/aistudio_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

### Step 3: Run Database Rename Script
```bash
# Start postgres service
docker compose up -d postgres

# Wait for it to be healthy
sleep 10

# Run the migration script
./scripts/rename-database.sh
```

The script will:
1. Check if the `aistudio` database exists
2. Create an automatic backup
3. Stop backend containers
4. Terminate all active connections
5. Rename the database from `aistudio` to `vibestudio`
6. Verify the rename was successful

### Step 4: Update Environment Files

Update your `.env` and `backend/.env` files to use the new database name:

```bash
# Old
DATABASE_URL="postgresql://postgres:PASSWORD@postgres:5432/aistudio?schema=public"

# New
DATABASE_URL="postgresql://postgres:PASSWORD@postgres:5432/vibestudio?schema=public"
```

Or for local development:
```bash
# Old
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/aistudio?schema=public"

# New
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/vibestudio?schema=public"
```

### Step 5: Rebuild and Restart Services

```bash
# For development
docker compose up -d --build

# For production
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 6: Verify Everything Works

```bash
# Check all containers are running
docker compose ps

# Check backend logs
docker compose logs -f backend

# Test the application
curl http://localhost:5174/  # Development
curl http://localhost/       # Production (via Caddy)
```

### Step 7: Update MCP Configuration

If you're using the MCP server, update your Claude Code configuration:

**Location:** `~/.config/claude-code/config.json` or `~/.claude/config.json`

```json
{
  "mcpServers": {
    "vibestudio": {
      "command": "node",
      "args": ["backend/dist/mcp/server.js"],
      "cwd": "/opt/stack/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:PASSWORD@localhost:5432/vibestudio?schema=public",
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Rollback Procedure

If something goes wrong, you can restore from the backup:

```bash
# Stop all services
docker compose down

# Start postgres
docker compose up -d postgres

# Wait for postgres
sleep 10

# Drop the new database
docker exec vibe-studio-postgres psql -U postgres -c "DROP DATABASE IF EXISTS vibestudio;"

# Create the old database
docker exec vibe-studio-postgres psql -U postgres -c "CREATE DATABASE aistudio;"

# Restore from backup
cat /tmp/aistudio_backup_TIMESTAMP.sql | docker exec -i vibe-studio-postgres psql -U postgres aistudio

# Revert container names in docker-compose files to old names
# Then restart
docker compose up -d
```

## Notes

1. **Network Names**: The internal network name `aistudio-network` was intentionally kept to avoid breaking the Caddy integration. If you need to rename this as well, you'll need to update Caddy's configuration accordingly.

2. **Container Names**: All container names have been updated. If you have any external scripts or monitoring tools that reference the old container names, update them accordingly.

3. **Database Content**: All your existing data will be preserved during the migration. The script only renames the database, it doesn't modify any data.

4. **Downtime**: There will be a brief downtime (typically 1-2 minutes) while the database is being renamed.

## Verification Checklist

After migration, verify:
- [ ] All containers start successfully
- [ ] Backend connects to database
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] MCP tools work (if using)
- [ ] No errors in logs
- [ ] Existing data is accessible

## Support

If you encounter any issues:
1. Check container logs: `docker compose logs`
2. Check database connectivity: `docker compose exec postgres psql -U postgres -d vibestudio -c "SELECT version();"`
3. Restore from backup if needed (see Rollback Procedure above)
