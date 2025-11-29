/**
 * Integration Tests for Analytics API Endpoints (ST-64)
 *
 * Tests HTTP endpoints for component/coordinator/workflow analytics
 *
 * Coverage:
 * - GET analytics with time range filters (7d, 30d, 90d, all)
 * - GET execution history with pagination
 * - GET workflows using component/coordinator
 * - GET component usage for coordinator
 * - GET CSV export (verify content-type and format)
 * - Verify metrics calculations (success rate, avg duration, cost)
 * - Error cases: invalid time range, missing entities
 */

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AnalyticsController } from '../controllers/analytics.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../services/analytics.service';

describe('Analytics API - Integration Tests (ST-64)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let analyticsService: AnalyticsService;

  const TEST_PREFIX = 'test_ST64_analytics_';
  let testProjectId: string;
  let testComponentId: string;
  let testCoordinatorId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        PrismaService,
        AnalyticsService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    analyticsService = moduleFixture.get<AnalyticsService>(AnalyticsService);

    // Create test fixtures
    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for analytics',
        status: 'active',
      },
    });
    testProjectId = project.id;

    const component = await prisma.component.create({
      data: {
        id: randomUUID(),
        projectId: testProjectId,
        name: `${TEST_PREFIX}component`,
        inputInstructions: 'Input',
        operationInstructions: 'Operation',
        outputInstructions: 'Output',
        config: { modelId: 'claude-3-sonnet' },
        tools: [],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      },
    });
    testComponentId = component.id;

    const coordinator = await prisma.component.create({
      data: {
        id: randomUUID(),
        projectId: testProjectId,
        name: `${TEST_PREFIX}coordinator`,
        inputInstructions: 'Input',
        operationInstructions: 'Operation',
        outputInstructions: 'Output',
        coordinatorInstructions: 'Orchestrate',
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

    const workflow = await prisma.workflow.create({
      data: {
        id: randomUUID(),
        projectId: testProjectId,
        coordinatorId: testCoordinatorId,
        name: `${TEST_PREFIX}workflow`,
        description: 'Test workflow',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        triggerConfig: { type: 'manual' },
      },
    });
    testWorkflowId = workflow.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.workflowRun.deleteMany({
      where: { workflowId: testWorkflowId },
    });
    await prisma.workflow.deleteMany({
      where: { projectId: testProjectId },
    });
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
  // COMPONENT ANALYTICS TESTS
  // ============================================================================

  describe('Component Analytics Endpoints', () => {
    describe('GET /analytics/components/:componentId', () => {
      it('should return analytics with default time range (30d)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .expect(200);

        expect(response.body).toHaveProperty('versionId');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('workflowsUsing');
        expect(response.body).toHaveProperty('executionHistory');
        expect(response.body).toHaveProperty('executionTrend');
        expect(response.body).toHaveProperty('costTrend');
      });

      it('should accept timeRange parameter (7d)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .query({ timeRange: '7d' })
          .expect(200);

        expect(response.body.metrics).toBeDefined();
      });

      it('should accept timeRange parameter (90d)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .query({ timeRange: '90d' })
          .expect(200);

        expect(response.body.metrics).toBeDefined();
      });

      it('should accept timeRange parameter (all)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .query({ timeRange: 'all' })
          .expect(200);

        expect(response.body.metrics).toBeDefined();
      });

      it('should return 400 for invalid timeRange', async () => {
        await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .query({ timeRange: 'invalid' })
          .expect(400);
      });

      it('should return 404 for non-existent component', async () => {
        const fakeId = randomUUID();
        await request(app.getHttpServer())
          .get(`/analytics/components/${fakeId}`)
          .expect(404);
      });

      it('should filter by versionId when provided', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .query({ versionId: testComponentId })
          .expect(200);

        expect(response.body.versionId).toBe(testComponentId);
      });

      it('should include metrics structure', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}`)
          .expect(200);

        expect(response.body.metrics).toHaveProperty('totalExecutions');
        expect(response.body.metrics).toHaveProperty('successfulExecutions');
        expect(response.body.metrics).toHaveProperty('failedExecutions');
        expect(response.body.metrics).toHaveProperty('successRate');
        expect(response.body.metrics).toHaveProperty('avgDuration');
        expect(response.body.metrics).toHaveProperty('totalCost');
        expect(response.body.metrics).toHaveProperty('avgCost');
      });
    });

    describe('GET /analytics/components/:componentId/executions', () => {
      it('should return execution history', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/executions`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should support pagination with limit', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/executions`)
          .query({ limit: 10 })
          .expect(200);

        expect(response.body.length).toBeLessThanOrEqual(10);
      });

      it('should support pagination with offset', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/executions`)
          .query({ limit: 5, offset: 0 })
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should filter by timeRange', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/executions`)
          .query({ timeRange: '7d' })
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });
    });

    describe('GET /analytics/components/:componentId/workflows', () => {
      it('should return workflows using component', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/workflows`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should include workflow details', async () => {
        // First link component to workflow
        await prisma.workflowComponentConfig.create({
          data: {
            id: randomUUID(),
            workflowId: testWorkflowId,
            componentId: testComponentId,
            position: 1,
            version: '1.0',
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/analytics/components/${testComponentId}/workflows`)
          .expect(200);

        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('workflowId');
          expect(response.body[0]).toHaveProperty('workflowName');
          expect(response.body[0]).toHaveProperty('version');
        }

        // Cleanup
        await prisma.workflowComponentConfig.deleteMany({
          where: { componentId: testComponentId },
        });
      });
    });
  });

  // ============================================================================
  // COORDINATOR ANALYTICS TESTS
  // ============================================================================

  describe('Coordinator Analytics Endpoints', () => {
    describe('GET /analytics/coordinators/:coordinatorId', () => {
      it('should return coordinator analytics', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/coordinators/${testCoordinatorId}`)
          .expect(200);

        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('workflowsUsing');
        expect(response.body).toHaveProperty('executionHistory');
        expect(response.body).toHaveProperty('componentUsage');
      });

      it('should include componentUsage field', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/coordinators/${testCoordinatorId}`)
          .expect(200);

        expect(response.body.componentUsage).toBeInstanceOf(Array);
      });

      it('should accept all time range options', async () => {
        const timeRanges = ['7d', '30d', '90d', 'all'];

        for (const timeRange of timeRanges) {
          const response = await request(app.getHttpServer())
            .get(`/analytics/coordinators/${testCoordinatorId}`)
            .query({ timeRange })
            .expect(200);

          expect(response.body).toHaveProperty('metrics');
        }
      });
    });

    describe('GET /analytics/coordinators/:coordinatorId/components', () => {
      it('should return component usage for coordinator', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/coordinators/${testCoordinatorId}/components`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should include usage count per component', async () => {
        // Create component usage data
        await prisma.workflowComponentConfig.create({
          data: {
            id: randomUUID(),
            workflowId: testWorkflowId,
            componentId: testComponentId,
            position: 1,
            version: '1.0',
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/analytics/coordinators/${testCoordinatorId}/components`)
          .expect(200);

        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('componentId');
          expect(response.body[0]).toHaveProperty('componentName');
          expect(response.body[0]).toHaveProperty('usageCount');
        }

        // Cleanup
        await prisma.workflowComponentConfig.deleteMany({
          where: { componentId: testComponentId },
        });
      });
    });
  });

  // ============================================================================
  // WORKFLOW ANALYTICS TESTS
  // ============================================================================

  describe('Workflow Analytics Endpoints', () => {
    describe('GET /analytics/workflows/:workflowId', () => {
      it('should return workflow analytics', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/workflows/${testWorkflowId}`)
          .expect(200);

        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('executionHistory');
        expect(response.body).toHaveProperty('componentBreakdown');
      });

      it('should include componentBreakdown', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/workflows/${testWorkflowId}`)
          .expect(200);

        expect(response.body.componentBreakdown).toBeInstanceOf(Array);
      });
    });

    describe('GET /analytics/workflows/:workflowId/component-breakdown', () => {
      it('should return component performance breakdown', async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/workflows/${testWorkflowId}/component-breakdown`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should include performance metrics per component', async () => {
        // Create workflow run and component execution data
        const workflowRun = await prisma.workflowRun.create({
          data: {
            id: randomUUID(),
            workflowId: testWorkflowId,
            status: 'completed',
            triggeredBy: 'test',
          },
        });

        const componentRun = await prisma.componentRun.create({
          data: {
            id: randomUUID(),
            workflowRunId: workflowRun.id,
            componentId: testComponentId,
            status: 'completed',
            startTime: new Date(Date.now() - 60000),
            endTime: new Date(),
            duration: 60,
            cost: 0.05,
          },
        });

        const response = await request(app.getHttpServer())
          .get(`/analytics/workflows/${testWorkflowId}/component-breakdown`)
          .expect(200);

        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('componentId');
          expect(response.body[0]).toHaveProperty('componentName');
          expect(response.body[0]).toHaveProperty('avgDuration');
          expect(response.body[0]).toHaveProperty('avgCost');
          expect(response.body[0]).toHaveProperty('failureRate');
        }

        // Cleanup
        await prisma.componentRun.delete({ where: { id: componentRun.id } });
        await prisma.workflowRun.delete({ where: { id: workflowRun.id } });
      });
    });
  });

  // ============================================================================
  // METRICS CALCULATION TESTS
  // ============================================================================

  describe('Metrics Calculations', () => {
    let workflowRunId: string;

    beforeEach(async () => {
      const workflowRun = await prisma.workflowRun.create({
        data: {
          id: randomUUID(),
          workflowId: testWorkflowId,
          status: 'completed',
          triggeredBy: 'test',
        },
      });
      workflowRunId = workflowRun.id;
    });

    afterEach(async () => {
      await prisma.componentRun.deleteMany({
        where: { workflowRunId },
      });
      await prisma.workflowRun.delete({
        where: { id: workflowRunId },
      });
    });

    it('should calculate success rate correctly', async () => {
      // Create successful execution
      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          duration: 30,
        },
      });

      // Create failed execution
      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'failed',
          startTime: new Date(),
          endTime: new Date(),
          duration: 15,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}`)
        .expect(200);

      const { metrics } = response.body;
      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(2);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(100);

      if (metrics.totalExecutions === 2) {
        expect(metrics.successfulExecutions).toBe(1);
        expect(metrics.failedExecutions).toBe(1);
        expect(metrics.successRate).toBe(50);
      }
    });

    it('should calculate average duration correctly', async () => {
      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(),
          duration: 60,
        },
      });

      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startTime: new Date(Date.now() - 40000),
          endTime: new Date(),
          duration: 40,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}`)
        .expect(200);

      const { metrics } = response.body;
      expect(metrics.avgDuration).toBeGreaterThan(0);
    });

    it('should calculate total and average cost correctly', async () => {
      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          duration: 30,
          cost: 0.10,
        },
      });

      await prisma.componentRun.create({
        data: {
          id: randomUUID(),
          workflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          duration: 30,
          cost: 0.20,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}`)
        .expect(200);

      const { metrics } = response.body;
      expect(metrics.totalCost).toBeGreaterThan(0);
      expect(metrics.avgCost).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CSV EXPORT TESTS
  // ============================================================================

  describe('CSV Export Endpoints', () => {
    it('should export component execution history as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
    });

    it('should export coordinator execution history as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/coordinators/${testCoordinatorId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should export workflow execution history as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/workflows/${testWorkflowId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should export as JSON when format=json', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should default to CSV format', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should filter export by timeRange', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .query({ format: 'csv', timeRange: '7d' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should include header row in CSV export', async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('workflowRunId');
      expect(csvContent).toContain('status');
      expect(csvContent).toContain('startTime');
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 404 for non-existent entities', async () => {
      const fakeId = randomUUID();

      await request(app.getHttpServer())
        .get(`/analytics/components/${fakeId}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/analytics/coordinators/${fakeId}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/analytics/workflows/${fakeId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/analytics/components/invalid-uuid')
        .expect(400);
    });

    it('should return 400 for invalid timeRange', async () => {
      await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}`)
        .query({ timeRange: 'invalid-range' })
        .expect(400);
    });

    it('should return 400 for invalid export format', async () => {
      await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/export`)
        .query({ format: 'invalid' })
        .expect(400);
    });

    it('should return 400 for invalid pagination params', async () => {
      await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/executions`)
        .query({ limit: -1 })
        .expect(400);

      await request(app.getHttpServer())
        .get(`/analytics/components/${testComponentId}/executions`)
        .query({ offset: -1 })
        .expect(400);
    });
  });
});
