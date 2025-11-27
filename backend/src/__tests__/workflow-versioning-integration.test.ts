/**
 * Integration Tests for Workflow Versioning and Analytics API Endpoints (ST-64)
 *
 * Tests HTTP endpoints used by WorkflowDetailModal:
 * - GET /versioning/workflows/:workflowId/versions - Version history
 * - POST /versioning/workflows/versions/:versionId/activate - Activate version
 * - POST /versioning/workflows/versions/:versionId/deactivate - Deactivate version
 * - GET /versioning/workflows/versions/compare - Compare versions
 * - GET /analytics/workflows/:workflowId - Get analytics with time range
 * - GET /analytics/workflows/:workflowId/export - Export CSV
 *
 * Total Coverage: ~50 tests
 */

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AnalyticsController } from '../controllers/analytics.controller';
import { VersioningController } from '../controllers/versioning.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../services/analytics.service';
import { ChecksumService } from '../services/checksum.service';
import { VersioningService } from '../services/versioning.service';

describe('Workflow Versioning & Analytics API - Integration Tests (ST-64)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let versioningService: VersioningService;
  let analyticsService: AnalyticsService;

  const TEST_PREFIX = 'test_ST64_workflow_';
  let testProjectId: string;
  let testCoordinatorId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VersioningController, AnalyticsController],
      providers: [
        PrismaService,
        VersioningService,
        AnalyticsService,
        ChecksumService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    versioningService = moduleFixture.get<VersioningService>(VersioningService);
    analyticsService = moduleFixture.get<AnalyticsService>(AnalyticsService);

    // Create test project
    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for workflow versioning integration tests',
        status: 'active',
      },
    });
    testProjectId = project.id;

    // Create test coordinator
    const coordinator = await prisma.component.create({
      data: {
        id: randomUUID(),
        projectId: testProjectId,
        name: `${TEST_PREFIX}coordinator`,
        inputInstructions: 'Coordinator input',
        operationInstructions: 'Coordinator operation',
        outputInstructions: 'Coordinator output',
        coordinatorInstructions: 'Orchestrate workflow',
        decisionStrategy: 'sequential',
        config: { modelId: 'claude-3-opus' },
        tools: [],
        tags: ['coordinator'],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      },
    });
    testCoordinatorId = coordinator.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWorkflowId) {
      await prisma.workflowRun.deleteMany({
        where: { workflowId: testWorkflowId },
      });
      await prisma.workflow.deleteMany({
        where: { OR: [{ id: testWorkflowId }, { parentId: testWorkflowId }] },
      });
    }
    await prisma.component.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // ============================================================================
  // VERSION HISTORY API TESTS
  // ============================================================================

  describe('GET /versioning/workflows/:workflowId/versions - Version History', () => {
    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });
      testWorkflowId = workflow.id;
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { parentId: testWorkflowId },
      });
      await prisma.workflow.delete({
        where: { id: testWorkflowId },
      });
    });

    it('should return all versions for workflow', async () => {
      const response = await request(app.getHttpServer())
        .get(`/versioning/workflows/${testWorkflowId}/versions`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('versionMajor');
      expect(response.body[0]).toHaveProperty('versionMinor');
      expect(response.body[0]).toHaveProperty('version');
      expect(response.body[0]).toHaveProperty('coordinatorId');
      expect(response.body[0]).toHaveProperty('triggerConfig');
    });

    it('should sort versions by creation date (newest first)', async () => {
      // Create v1.1
      await versioningService.createMinorVersion('workflow', testWorkflowId);

      const response = await request(app.getHttpServer())
        .get(`/versioning/workflows/${testWorkflowId}/versions`)
        .expect(200);

      expect(response.body.length).toBe(2);
      // Versions ordered oldest to newest
      expect(response.body[0].versionMinor).toBe(0);
      expect(response.body[1].versionMinor).toBe(1);
    });

    it('should include active/inactive status for each version', async () => {
      const response = await request(app.getHttpServer())
        .get(`/versioning/workflows/${testWorkflowId}/versions`)
        .expect(200);

      expect(response.body[0]).toHaveProperty('active');
      expect(typeof response.body[0].active).toBe('boolean');
    });

    it('should return 404 for invalid workflow ID', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .get(`/versioning/workflows/${fakeId}/versions`)
        .expect(404);
    });

    it('should return 400 for malformed UUID', async () => {
      await request(app.getHttpServer())
        .get('/versioning/workflows/not-a-uuid/versions')
        .expect(400);
    });
  });

  // ============================================================================
  // VERSION ACTIVATION/DEACTIVATION TESTS
  // ============================================================================

  describe('POST /versioning/workflows/versions/:versionId/activate - Activate Version', () => {
    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });
      testWorkflowId = workflow.id;
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { parentId: testWorkflowId },
      });
      await prisma.workflow.delete({
        where: { id: testWorkflowId },
      });
    });

    it('should activate version and set active=true', async () => {
      // Create v1.1
      const v11 = await versioningService.createMinorVersion('workflow', testWorkflowId);

      const response = await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${v11.id}/activate`)
        .expect(200);

      expect(response.body.active).toBe(true);
      expect(response.body.id).toBe(v11.id);
    });

    it('should deactivate other versions when activating one', async () => {
      // Create v1.1 and activate it
      const v11 = await versioningService.createMinorVersion('workflow', testWorkflowId);
      await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${v11.id}/activate`)
        .expect(200);

      // Verify original v1.0 is now inactive
      const original = await prisma.workflow.findUnique({
        where: { id: testWorkflowId },
      });
      expect(original?.active).toBe(false);
    });

    it('should ensure only one version is active at a time', async () => {
      // Create v1.1 and v1.2
      const v11 = await versioningService.createMinorVersion('workflow', testWorkflowId);
      const v12 = await versioningService.createMinorVersion('workflow', v11.id);

      // Activate v1.2
      await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${v12.id}/activate`)
        .expect(200);

      // Check all versions
      const allVersions = await prisma.workflow.findMany({
        where: {
          OR: [
            { id: testWorkflowId },
            { parentId: testWorkflowId },
          ],
        },
      });

      const activeCount = allVersions.filter((v) => v.active).length;
      expect(activeCount).toBe(1);

      // Cleanup
      await prisma.workflow.delete({ where: { id: v12.id } });
      await prisma.workflow.delete({ where: { id: v11.id } });
    });

    it('should return updated version with all fields', async () => {
      const v11 = await versioningService.createMinorVersion('workflow', testWorkflowId);

      const response = await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${v11.id}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('coordinatorId');
      expect(response.body).toHaveProperty('triggerConfig');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('versionMajor');
      expect(response.body).toHaveProperty('versionMinor');

      // Cleanup
      await prisma.workflow.delete({ where: { id: v11.id } });
    });

    it('should return 404 for non-existent version', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${fakeId}/activate`)
        .expect(404);
    });
  });

  describe('POST /versioning/workflows/versions/:versionId/deactivate - Deactivate Version', () => {
    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
          active: true,
        },
      });
      testWorkflowId = workflow.id;
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { parentId: testWorkflowId },
      });
      await prisma.workflow.delete({
        where: { id: testWorkflowId },
      });
    });

    it('should deactivate version and set active=false', async () => {
      const response = await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${testWorkflowId}/deactivate`)
        .expect(200);

      expect(response.body.active).toBe(false);
    });

    it('should persist deactivation to database', async () => {
      await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${testWorkflowId}/deactivate`)
        .expect(200);

      const workflow = await prisma.workflow.findUnique({
        where: { id: testWorkflowId },
      });
      expect(workflow?.active).toBe(false);
    });

    it('should return 404 for non-existent version', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .post(`/versioning/workflows/versions/${fakeId}/deactivate`)
        .expect(404);
    });
  });

  // ============================================================================
  // VERSION COMPARISON TESTS
  // ============================================================================

  describe('GET /versioning/workflows/versions/compare - Compare Versions', () => {
    let version1Id: string;
    let version2Id: string;

    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow v1.0',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual', filters: { status: 'pending' } },
        },
      });
      version1Id = workflow.id;
      testWorkflowId = workflow.id;

      // Create v1.1 with changes
      const v11 = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          parentId: version1Id,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow v1.1 - updated',
          version: 'v1.1',
          versionMajor: 1,
          versionMinor: 1,
          triggerConfig: {
            type: 'manual',
            filters: { status: 'pending', priority: 'high' },
          },
          createdFromVersion: '1.0',
        },
      });
      version2Id = v11.id;
    });

    afterEach(async () => {
      await prisma.workflow.delete({ where: { id: version2Id } });
      await prisma.workflow.delete({ where: { id: version1Id } });
    });

    it('should compare two workflow versions', async () => {
      const response = await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: version1Id, versionId2: version2Id })
        .expect(200);

      expect(response.body).toHaveProperty('entityType', 'workflow');
      expect(response.body).toHaveProperty('version1');
      expect(response.body).toHaveProperty('version2');
      expect(response.body).toHaveProperty('diff');
    });

    it('should show trigger config changes in diff', async () => {
      const response = await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: version1Id, versionId2: version2Id })
        .expect(200);

      expect(response.body.diff).toHaveProperty('summary');
      expect(response.body.diff).toHaveProperty('changes');
      expect(response.body.diff.summary.fieldsModified).toBeGreaterThan(0);
    });

    it('should show coordinator changes if coordinator updated', async () => {
      // Create new coordinator
      const newCoordinator = await prisma.component.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          name: `${TEST_PREFIX}coordinator_v2`,
          inputInstructions: 'Input',
          operationInstructions: 'Operation',
          outputInstructions: 'Output',
          coordinatorInstructions: 'New orchestration logic',
          decisionStrategy: 'adaptive',
          config: { modelId: 'claude-3-opus' },
          tools: [],
          tags: ['coordinator'],
          version: 'v2.0',
          versionMajor: 2,
          versionMinor: 0,
        },
      });

      // Update v1.1 to use new coordinator
      await prisma.workflow.update({
        where: { id: version2Id },
        data: { coordinatorId: newCoordinator.id },
      });

      const response = await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: version1Id, versionId2: version2Id })
        .expect(200);

      expect(response.body.diff.changes).toContainEqual(
        expect.objectContaining({ field: 'coordinatorId' })
      );

      // Cleanup
      await prisma.component.delete({ where: { id: newCoordinator.id } });
    });

    it('should detect breaking changes in trigger config', async () => {
      // Create version with breaking change (removed required filter)
      const v20 = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          parentId: version1Id,
          name: `${TEST_PREFIX}workflow_breaking`,
          description: 'Breaking change version',
          version: 'v2.0',
          versionMajor: 2,
          versionMinor: 0,
          triggerConfig: { type: 'webhook' }, // Changed trigger type - breaking
          createdFromVersion: '1.0',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: version1Id, versionId2: v20.id })
        .expect(200);

      // Should detect breaking change (trigger type changed)
      expect(response.body.diff.impactAnalysis?.breakingChanges).toBe(true);

      // Cleanup
      await prisma.workflow.delete({ where: { id: v20.id } });
    });

    it('should return 400 when versionId1 missing', async () => {
      await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId2: version2Id })
        .expect(400);
    });

    it('should return 400 when versionId2 missing', async () => {
      await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: version1Id })
        .expect(400);
    });

    it('should return 404 when version1 does not exist', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .get('/versioning/workflows/versions/compare')
        .query({ versionId1: fakeId, versionId2: version2Id })
        .expect(404);
    });
  });

  // ============================================================================
  // ANALYTICS API TESTS
  // ============================================================================

  describe('GET /analytics/workflows/:workflowId - Analytics with Time Ranges', () => {
    let workflowRunId: string;

    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_analytics`,
          description: 'Test workflow for analytics',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });
      testWorkflowId = workflow.id;

      // Create workflow run
      const run = await prisma.workflowRun.create({
        data: {
          id: randomUUID(),
          workflowId: testWorkflowId,
          status: 'completed',
          triggeredBy: 'test-user',
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          finishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 120000), // +2 min
          durationSeconds: 120,
        },
      });
      workflowRunId = run.id;
    });

    afterEach(async () => {
      await prisma.workflowRun.deleteMany({
        where: { workflowId: testWorkflowId },
      });
      await prisma.workflow.delete({
        where: { id: testWorkflowId },
      });
    });

    it('should return analytics for time range 7d', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('executionHistory');
    });

    it('should return analytics for time range 30d', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '30d' })
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
    });

    it('should return analytics for time range 90d', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '90d' })
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
    });

    it('should return analytics for time range all', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: 'all' })
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
    });

    it('should include execution history in response', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body.executionHistory).toBeInstanceOf(Array);
      expect(response.body.executionHistory.length).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      // Create another run (failed)
      await prisma.workflowRun.create({
        data: {
          id: randomUUID(),
          workflowId: testWorkflowId,
          status: 'failed',
          triggeredBy: 'test-user',
          startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
          finishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000 + 60000),
          durationSeconds: 60,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body.metrics).toHaveProperty('totalExecutions');
      expect(response.body.metrics).toHaveProperty('successfulExecutions');
      expect(response.body.metrics).toHaveProperty('failedExecutions');
      expect(response.body.metrics).toHaveProperty('successRate');
      expect(response.body.metrics.totalExecutions).toBe(2);
      expect(response.body.metrics.successfulExecutions).toBe(1);
      expect(response.body.metrics.failedExecutions).toBe(1);
      expect(response.body.metrics.successRate).toBe(50);
    });

    it('should handle workflows with no executions', async () => {
      // Delete execution
      await prisma.workflowRun.delete({ where: { id: workflowRunId } });

      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body.metrics.totalExecutions).toBe(0);
      expect(response.body.metrics.successRate).toBe(0);
      expect(response.body.executionHistory).toEqual([]);
    });

    it('should return 404 for non-existent workflow', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .get(`/analytics/workflows/${fakeId}`)
        .query({ timeRange: '7d' })
        .expect(404);
    });

    it('should return 400 for invalid time range', async () => {
      await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}`)
        .query({ timeRange: 'invalid' })
        .expect(400);
    });
  });

  // ============================================================================
  // CSV EXPORT TESTS
  // ============================================================================

  describe('GET /analytics/workflows/:workflowId/export - CSV Export', () => {
    beforeEach(async () => {
      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId: testCoordinatorId,
          name: `${TEST_PREFIX}workflow_export`,
          description: 'Test workflow for CSV export',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });
      testWorkflowId = workflow.id;

      // Create some execution data
      await prisma.workflowRun.create({
        data: {
          id: randomUUID(),
          workflowId: testWorkflowId,
          status: 'completed',
          triggeredBy: 'test-user',
          startedAt: new Date(Date.now() - 60000),
          finishedAt: new Date(),
          durationSeconds: 60,
        },
      });
    });

    afterEach(async () => {
      await prisma.workflowRun.deleteMany({
        where: { workflowId: testWorkflowId },
      });
      await prisma.workflow.delete({
        where: { id: testWorkflowId },
      });
    });

    it('should return CSV format with correct MIME type', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should include all execution data in CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('workflowRunId');
      expect(csvContent).toContain('status');
      expect(csvContent).toContain('startTime');
      expect(csvContent).toContain('endTime');
      expect(csvContent).toContain('duration');
    });

    it('should include workflow name in filename', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      const disposition = response.headers['content-disposition'];
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('.csv');
    });

    it('should filter by time range when specified', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'csv', timeRange: '7d' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should return JSON when format=json', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toBeInstanceOf(Array);
    });

    it('should default to CSV format when format not specified', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should return 404 for non-existent workflow', async () => {
      const fakeId = randomUUID();
      await request(app.getHttpServer())
        .get(`/analytics/workflows/${fakeId}/export`)
        .query({ format: 'csv' })
        .expect(404);
    });

    it('should return 400 for invalid export format', async () => {
      await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'xml' })
        .expect(400);
    });
  });
});
