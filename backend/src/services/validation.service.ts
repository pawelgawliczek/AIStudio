/**
 * Validation Service - Post-migration validation and verification
 */

import { PrismaClient } from '@prisma/client';
import {
  ValidationResult,
  ValidationLevel,
  ValidationCheck,
  ValidationResults,
} from '../types/migration.types';
import { migrationConfig } from '../../config/migration.config';
import { dockerExec } from '../utils/docker-exec.util';

const prisma = new PrismaClient();

export class ValidationService {
  private containerName: string;
  private database: string;
  private username: string;

  constructor() {
    this.containerName = migrationConfig.docker.containerName;
    this.database = migrationConfig.docker.database;
    this.username = migrationConfig.docker.username;
  }

  /**
   * Run all validation levels
   */
  async validateAll(): Promise<ValidationResults> {
    console.log('[ValidationService] Running all validation levels...');

    const results: ValidationResults = {
      schema: await this.validateSchema(),
    };

    // Only continue if schema validation passes
    if (results.schema.passed) {
      results.dataIntegrity = await this.validateDataIntegrity();

      if (results.dataIntegrity.passed) {
        results.health = await this.validateHealth();

        if (results.health.passed) {
          results.smokeTests = await this.runSmokeTests();
        }
      }
    }

    return results;
  }

  /**
   * Level 1: Schema Validation
   */
  async validateSchema(): Promise<ValidationResult> {
    console.log('[ValidationService] Level 1: Schema Validation...');
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];

    try {
      // Check 1: Tables exist
      const tablesResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`,
        timeout: 10000,
      });

      const tableCount = tablesResult.success
        ? parseInt(tablesResult.stdout.trim(), 10)
        : 0;

      checks.push({
        name: 'Tables exist',
        passed: tableCount > 0,
        message: `Found ${tableCount} tables`,
        details: { tableCount },
      });

      if (tableCount === 0) {
        errors.push('No tables found in database');
      }

      // Check 2: Critical tables exist
      const criticalTables = [
        'projects',
        'epics',
        'stories',
        'use_cases',
        'test_cases',
        'workflows',
        'workflow_components',
        'workflow_runs',
      ];

      for (const table of criticalTables) {
        const result = await dockerExec({
          containerName: this.containerName,
          command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');"`,
          timeout: 5000,
        });

        const exists = result.success && result.stdout.trim() === 't';

        checks.push({
          name: `Table '${table}' exists`,
          passed: exists,
          message: exists ? 'OK' : 'Missing',
        });

        if (!exists) {
          errors.push(`Critical table '${table}' not found`);
        }
      }

      // Check 3: Indexes exist
      const indexResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';"`,
        timeout: 10000,
      });

      const indexCount = indexResult.success
        ? parseInt(indexResult.stdout.trim(), 10)
        : 0;

      checks.push({
        name: 'Indexes exist',
        passed: indexCount > 0,
        message: `Found ${indexCount} indexes`,
        details: { indexCount },
      });

      // Check 4: Foreign key constraints
      const fkResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND constraint_schema = 'public';"`,
        timeout: 10000,
      });

      const fkCount = fkResult.success
        ? parseInt(fkResult.stdout.trim(), 10)
        : 0;

      checks.push({
        name: 'Foreign key constraints',
        passed: fkCount > 0,
        message: `Found ${fkCount} foreign keys`,
        details: { fkCount },
      });
    } catch (error: any) {
      errors.push(`Schema validation error: ${error.message}`);
    }

    const passed = checks.every((c) => c.passed) && errors.length === 0;
    const duration = Date.now() - startTime;

    return {
      level: ValidationLevel.SCHEMA,
      passed,
      checks,
      errors,
      duration,
    };
  }

  /**
   * Level 2: Data Integrity Validation
   */
  async validateDataIntegrity(): Promise<ValidationResult> {
    console.log('[ValidationService] Level 2: Data Integrity Validation...');
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];

    try {
      // Check 1: Prisma Client connection
      try {
        await prisma.$connect();
        checks.push({
          name: 'Prisma Client connection',
          passed: true,
          message: 'Connected successfully',
        });
      } catch (error: any) {
        checks.push({
          name: 'Prisma Client connection',
          passed: false,
          message: error.message,
        });
        errors.push(`Prisma connection failed: ${error.message}`);
      }

      // Check 2: Primary key uniqueness (sample check on projects)
      try {
        const duplicates = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM (
            SELECT id, COUNT(*) as cnt
            FROM projects
            GROUP BY id
            HAVING COUNT(*) > 1
          ) as dupes
        `;

        const hasDuplicates = Number(duplicates[0]?.count || 0) > 0;

        checks.push({
          name: 'Primary key uniqueness (projects)',
          passed: !hasDuplicates,
          message: hasDuplicates ? 'Duplicate IDs found' : 'All IDs unique',
        });

        if (hasDuplicates) {
          errors.push('Duplicate primary keys found in projects table');
        }
      } catch (error: any) {
        checks.push({
          name: 'Primary key uniqueness check',
          passed: false,
          message: error.message,
        });
      }

      // Check 3: Foreign key integrity (sample check)
      try {
        const orphanedStories = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM stories s
          LEFT JOIN projects p ON s."projectId" = p.id
          WHERE p.id IS NULL
        `;

        const hasOrphans = Number(orphanedStories[0]?.count || 0) > 0;

        checks.push({
          name: 'Foreign key integrity (stories->projects)',
          passed: !hasOrphans,
          message: hasOrphans
            ? `${orphanedStories[0]?.count} orphaned stories found`
            : 'All foreign keys valid',
        });

        if (hasOrphans) {
          errors.push('Orphaned stories found (invalid project references)');
        }
      } catch (error: any) {
        checks.push({
          name: 'Foreign key integrity check',
          passed: false,
          message: error.message,
        });
      }

      // Check 4: NOT NULL constraints on critical fields
      try {
        const nullProjects = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM projects
          WHERE name IS NULL OR "createdAt" IS NULL
        `;

        const hasNulls = Number(nullProjects[0]?.count || 0) > 0;

        checks.push({
          name: 'NOT NULL constraints (projects)',
          passed: !hasNulls,
          message: hasNulls ? 'NULL values found in required fields' : 'All required fields populated',
        });

        if (hasNulls) {
          errors.push('NULL values found in required project fields');
        }
      } catch (error: any) {
        checks.push({
          name: 'NOT NULL constraints check',
          passed: false,
          message: error.message,
        });
      }
    } catch (error: any) {
      errors.push(`Data integrity validation error: ${error.message}`);
    } finally {
      await prisma.$disconnect();
    }

    const passed = checks.every((c) => c.passed) && errors.length === 0;
    const duration = Date.now() - startTime;

    return {
      level: ValidationLevel.DATA_INTEGRITY,
      passed,
      checks,
      errors,
      duration,
    };
  }

  /**
   * Level 3: Application Health Checks
   */
  async validateHealth(): Promise<ValidationResult> {
    console.log('[ValidationService] Level 3: Application Health Checks...');
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];

    try {
      // Check 1: Prisma Client generation
      try {
        await prisma.$connect();
        checks.push({
          name: 'Prisma Client functional',
          passed: true,
          message: 'Prisma Client operational',
        });
        await prisma.$disconnect();
      } catch (error: any) {
        checks.push({
          name: 'Prisma Client functional',
          passed: false,
          message: error.message,
        });
        errors.push(`Prisma Client not functional: ${error.message}`);
      }

      // Check 2: Database connection pool
      try {
        await prisma.$connect();
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT 1 as count`;
        const canQuery = result.length > 0;

        checks.push({
          name: 'Database query execution',
          passed: canQuery,
          message: canQuery ? 'Queries executing successfully' : 'Cannot execute queries',
        });

        if (!canQuery) {
          errors.push('Cannot execute database queries');
        }
        await prisma.$disconnect();
      } catch (error: any) {
        checks.push({
          name: 'Database query execution',
          passed: false,
          message: error.message,
        });
        errors.push(`Query execution failed: ${error.message}`);
      }

      // Check 3: Critical table row counts
      try {
        await prisma.$connect();
        const projectCount = await prisma.project.count();
        const storyCount = await prisma.story.count();

        checks.push({
          name: 'Data accessible',
          passed: true,
          message: `${projectCount} projects, ${storyCount} stories`,
          details: { projectCount, storyCount },
        });
        await prisma.$disconnect();
      } catch (error: any) {
        checks.push({
          name: 'Data accessible',
          passed: false,
          message: error.message,
        });
        errors.push(`Cannot access data: ${error.message}`);
      }
    } catch (error: any) {
      errors.push(`Health validation error: ${error.message}`);
    }

    const passed = checks.every((c) => c.passed) && errors.length === 0;
    const duration = Date.now() - startTime;

    return {
      level: ValidationLevel.HEALTH,
      passed,
      checks,
      errors,
      duration,
    };
  }

  /**
   * Level 4: Smoke Tests
   */
  async runSmokeTests(): Promise<ValidationResult> {
    console.log('[ValidationService] Level 4: Smoke Tests...');
    const startTime = Date.now();
    const checks: ValidationCheck[] = [];
    const errors: string[] = [];

    try {
      await prisma.$connect();

      // Smoke Test 1: Query projects
      try {
        const projects = await prisma.project.findMany({ take: 1 });
        checks.push({
          name: 'Query projects',
          passed: true,
          message: `Retrieved ${projects.length} project(s)`,
        });
      } catch (error: any) {
        checks.push({
          name: 'Query projects',
          passed: false,
          message: error.message,
        });
        errors.push(`Cannot query projects: ${error.message}`);
      }

      // Smoke Test 2: Query stories
      try {
        const stories = await prisma.story.findMany({ take: 1 });
        checks.push({
          name: 'Query stories',
          passed: true,
          message: `Retrieved ${stories.length} story(ies)`,
        });
      } catch (error: any) {
        checks.push({
          name: 'Query stories',
          passed: false,
          message: error.message,
        });
        errors.push(`Cannot query stories: ${error.message}`);
      }

      // Smoke Test 3: Query use cases
      try {
        const useCases = await prisma.useCase.findMany({ take: 1 });
        checks.push({
          name: 'Query use cases',
          passed: true,
          message: `Retrieved ${useCases.length} use case(s)`,
        });
      } catch (error: any) {
        checks.push({
          name: 'Query use cases',
          passed: false,
          message: error.message,
        });
        errors.push(`Cannot query use cases: ${error.message}`);
      }

      // Smoke Test 4: Query workflows
      try {
        const workflows = await prisma.workflow.findMany({ take: 1 });
        checks.push({
          name: 'Query workflows',
          passed: true,
          message: `Retrieved ${workflows.length} workflow(s)`,
        });
      } catch (error: any) {
        checks.push({
          name: 'Query workflows',
          passed: false,
          message: error.message,
        });
        errors.push(`Cannot query workflows: ${error.message}`);
      }

      // Smoke Test 5: Complex join query
      try {
        const storiesWithProjects = await prisma.story.findMany({
          take: 1,
          include: { project: true },
        });
        checks.push({
          name: 'Join query (stories with projects)',
          passed: true,
          message: `Join query successful`,
        });
      } catch (error: any) {
        checks.push({
          name: 'Join query',
          passed: false,
          message: error.message,
        });
        errors.push(`Join query failed: ${error.message}`);
      }

      await prisma.$disconnect();
    } catch (error: any) {
      errors.push(`Smoke tests error: ${error.message}`);
    }

    const passed = checks.every((c) => c.passed) && errors.length === 0;
    const duration = Date.now() - startTime;

    return {
      level: ValidationLevel.SMOKE_TESTS,
      passed,
      checks,
      errors,
      duration,
    };
  }
}
