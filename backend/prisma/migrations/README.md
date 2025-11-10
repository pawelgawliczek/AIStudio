# Database Migrations

This directory contains Prisma database migrations for the AI Studio MCP Control Plane.

## Applying Migrations

### Development Environment

To apply migrations in a development environment:

```bash
cd backend
npx prisma migrate dev
```

### Production Environment

To apply migrations in production:

```bash
cd backend
npx prisma migrate deploy
```

## Manual Migration Application

If Prisma CLI is not available (network issues, offline environment), you can apply migrations manually:

1. Connect to your PostgreSQL database
2. Navigate to each migration directory in chronological order
3. Execute the `migration.sql` file contents

Example using psql:

```bash
psql $DATABASE_URL -f backend/prisma/migrations/20251110141007_update_story_status_enum/migration.sql
```

## Current Migrations

### 20251110141007_update_story_status_enum

- **Purpose**: Sprint 6 - Add Kanban workflow support
- **Changes**:
  - Add `backlog` status to StoryStatus enum
  - Add `blocked` status to StoryStatus enum
- **Impact**: Enables full Kanban board workflow in Planning View

## Initial Schema Setup

If this is a fresh database, first run:

```bash
cd backend
npx prisma migrate dev --name init
```

This will create all tables, indexes, and enums from the schema.prisma file.

## Troubleshooting

### Prisma Engine Download Errors (403 Forbidden)

If you encounter network errors when downloading Prisma engines:

```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate dev
```

Or manually apply the SQL files as described above.

### Enum Value Already Exists

PostgreSQL's `ADD VALUE IF NOT EXISTS` is only available in PostgreSQL 12+. If using an older version, you may need to check if the value exists before adding:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'backlog' AND enumtypid =
    (SELECT oid FROM pg_type WHERE typname = 'StoryStatus')) THEN
    ALTER TYPE "StoryStatus" ADD VALUE 'backlog';
  END IF;
END $$;
```
