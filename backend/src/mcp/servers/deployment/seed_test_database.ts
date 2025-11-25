/**
 * MCP Tool: Seed Test Database
 *
 * Seeds the test database with production data (read-only snapshot).
 * This should be run ONCE after test environment setup, not on every deployment.
 *
 * Use cases:
 * - Initial test environment setup
 * - After test database reset/cleanup
 * - When test data needs to be refreshed from production
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types.js';
import { validateRequired } from '../../utils.js';
import {
  assertNotProductionDb,
  TEST,
} from '../../../config/environments.js';

// Input/Output Types
export interface SeedTestDatabaseParams {
  force?: boolean; // Force re-seed even if data exists
}

export interface SeedTestDatabaseResponse {
  success: boolean;
  recordsSeeded: {
    stories: number;
    epics: number;
    components: number;
    workflows: number;
  };
  duration: number;
  message: string;
}

// Tool definition
export const tool: Tool = {
  name: 'mcp__vibestudio__seed_test_database',
  description: `Seed test database with production data snapshot.

**PURPOSE:**
Creates a read-only snapshot of production data and loads it into the test database.
This allows testing with realistic data without affecting production.

**WHEN TO USE:**
- Initial test environment setup
- After test database cleanup/reset
- When test data needs refresh from production

**SAFETY:**
- Only targets test database (port 5434)
- Production database is read-only source
- Automatic truncate before seeding (if force=true)

**PROCESS:**
1. Validates test database connection
2. Dumps production data (read-only)
3. Truncates test database tables (if force=true)
4. Restores production data to test DB
5. Verifies data integrity

**PARAMETERS:**
- force (optional): Truncate existing test data before seeding (default: false)`,
  inputSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Truncate existing test data before seeding (default: false)'
      }
    }
  }
};

// Tool metadata
export const metadata = {
  category: 'deployment',
  domain: 'testing',
  tags: ['deployment', 'testing', 'database', 'seeding'],
  version: '1.0.0'
};

// Main handler
export async function handler(
  prisma: PrismaClient,
  params: SeedTestDatabaseParams = {}
): Promise<SeedTestDatabaseResponse> {
  const startTime = Date.now();
  const { force = false } = params;

  const PROD_DB_HOST = process.env.PROD_DB_HOST || '127.0.0.1';
  const PROD_DB_PORT = process.env.PROD_DB_PORT || '5433';
  const PROD_DB_USER = process.env.PROD_DB_USER || 'postgres';
  const PROD_DB_PASSWORD = process.env.PROD_DB_PASSWORD || '361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518';
  const PROD_DB_NAME = process.env.PROD_DB_NAME || 'vibestudio';

  const testDbUrl = `postgresql://postgres:test@${TEST.DB_HOST}:${TEST.DB_PORT}/${TEST.DB_NAME}?schema=public`;

  // SAFETY: Ensure we're targeting test database
  assertNotProductionDb(testDbUrl, 'seed data');
  console.log(`✓ Safety check passed: targeting test DB on port ${TEST.DB_PORT}`);

  try {
    const mainWorktreePath = '/opt/stack/AIStudio';
    const dumpPath = join(mainWorktreePath, 'backups', 'test-seed-snapshot.dump');

    // Step 1: Create production data snapshot
    console.log('Creating production data snapshot...');
    execSync(
      `PGPASSWORD='${PROD_DB_PASSWORD}' pg_dump -h ${PROD_DB_HOST} -p ${PROD_DB_PORT} -U ${PROD_DB_USER} -d ${PROD_DB_NAME} --data-only --format=custom --file="${dumpPath}"`,
      { cwd: mainWorktreePath, encoding: 'utf-8', timeout: 120000 }
    );
    console.log(`✓ Production data dumped to ${dumpPath}`);

    // Step 2: Truncate existing test data (if force=true)
    if (force) {
      console.log('Truncating existing test database data...');
      const testDbConnection = `PGPASSWORD=test psql -h ${TEST.DB_HOST} -p ${TEST.DB_PORT} -U postgres -d ${TEST.DB_NAME}`;

      const truncateSql = `
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `;

      execSync(
        `echo "${truncateSql.replace(/"/g, '\\"')}" | ${testDbConnection}`,
        { cwd: mainWorktreePath, encoding: 'utf-8', timeout: 30000, shell: '/bin/bash' }
      );
      console.log('✓ Test database truncated');
    }

    // Step 3: Restore production data to test database
    console.log(`Restoring production data to test DB (port ${TEST.DB_PORT})...`);
    execSync(
      `PGPASSWORD=test pg_restore -h ${TEST.DB_HOST} -p ${TEST.DB_PORT} -U postgres -d ${TEST.DB_NAME} --data-only --no-owner --no-acl "${dumpPath}"`,
      { cwd: mainWorktreePath, encoding: 'utf-8', timeout: 120000 }
    );
    console.log('✓ Production data restored to test database');

    // Step 4: Verify data integrity
    const testDbConnection = `PGPASSWORD=test psql -h ${TEST.DB_HOST} -p ${TEST.DB_PORT} -U postgres -d ${TEST.DB_NAME}`;
    const counts = execSync(
      `${testDbConnection} -t -c "SELECT (SELECT COUNT(*) FROM stories) as stories, (SELECT COUNT(*) FROM epics) as epics, (SELECT COUNT(*) FROM components) as components, (SELECT COUNT(*) FROM workflows) as workflows;"`,
      { cwd: mainWorktreePath, encoding: 'utf-8', timeout: 10000 }
    ).trim();

    const [stories, epics, components, workflows] = counts.split('|').map(s => parseInt(s.trim(), 10));

    console.log(`✓ Test DB seeded: ${stories} stories, ${epics} epics, ${components} components, ${workflows} workflows`);

    // Step 5: Cleanup dump file
    try {
      execSync(`rm -f "${dumpPath}"`, { cwd: mainWorktreePath });
    } catch (cleanupError) {
      console.warn('Warning: Failed to cleanup dump file:', cleanupError);
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      recordsSeeded: {
        stories,
        epics,
        components,
        workflows
      },
      duration,
      message: `Test database seeded successfully in ${(duration / 1000).toFixed(1)}s. ${stories} stories, ${epics} epics, ${components} components, ${workflows} workflows.`
    };
  } catch (error: any) {
    throw new ValidationError(
      `Failed to seed test database: ${error.message}`,
      {
        phase: 'seeding',
        error: error.message
      }
    );
  }
}
