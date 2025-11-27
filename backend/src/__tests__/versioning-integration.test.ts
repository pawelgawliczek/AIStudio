/**
 * Integration Tests for Versioning API Endpoints (ST-64)
 *
 * Tests HTTP endpoints for component/coordinator/workflow versioning
 *
 * Coverage:
 * - GET version history for component/coordinator/workflow
 * - GET specific version by ID
 * - POST create new version (major/minor)
 * - POST activate version (deactivates others)
 * - POST deactivate version
 * - GET compare two versions (detect breaking changes)
 * - POST verify checksum (MD5)
 * - Error cases: 404 not found, 400 validation errors
 */

import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { VersioningController } from '../controllers/versioning.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ChecksumService } from '../services/checksum.service';
import { VersioningService } from '../services/versioning.service';

describe('Versioning API - Integration Tests (ST-64)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let versioningService: VersioningService;
  let checksumService: ChecksumService;

  const TEST_PREFIX = 'test_ST64_';
  let testProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VersioningController],
      providers: [
        PrismaService,
        VersioningService,
        ChecksumService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    versioningService = moduleFixture.get<VersioningService>(VersioningService);
    checksumService = moduleFixture.get<ChecksumService>(ChecksumService);

    // Create test project
    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for ST-64 versioning integration tests',
        status: 'active',
      },
    });
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Cleanup test data
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
  // COMPONENT VERSIONING TESTS
  // ============================================================================

  describe('Component Versioning Endpoints', () => {
    let componentId: string;
    let versionId: string;

    beforeEach(async () => {
      const component = await prisma.component.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          name: `${TEST_PREFIX}component_${Date.now()}`,
          inputInstructions: 'Original input instructions',
          operationInstructions: 'Original operation instructions',
          outputInstructions: 'Original output instructions',
          config: { modelId: 'claude-3-sonnet', temperature: 0.7 },
          tools: ['tool1', 'tool2'],
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      });
      componentId = component.id;
    });

    afterEach(async () => {
      // Cleanup versions created in tests
      await prisma.component.deleteMany({
        where: { parentId: componentId },
      });
      await prisma.component.delete({
        where: { id: componentId },
      });
    });

    describe('GET /versioning/components/:componentId/versions', () => {
      it('should return version history for component', async () => {
        const response = await request(app.getHttpServer())
          .get(`/versioning/components/${componentId}/versions`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('versionMajor');
        expect(response.body[0]).toHaveProperty('versionMinor');
        expect(response.body[0]).toHaveProperty('version');
      });

      it('should return 404 for non-existent component', async () => {
        const fakeId = randomUUID();
        await request(app.getHttpServer())
          .get(`/versioning/components/${fakeId}/versions`)
          .expect(404);
      });

      it('should return versions ordered from oldest to newest', async () => {
        // Create minor version
        const v11 = await versioningService.createMinorVersion('component', componentId);

        const response = await request(app.getHttpServer())
          .get(`/versioning/components/${componentId}/versions`)
          .expect(200);

        expect(response.body.length).toBe(2);
        expect(response.body[0].versionMinor).toBe(0);
        expect(response.body[1].versionMinor).toBe(1);

        // Cleanup
        await prisma.component.delete({ where: { id: v11.id } });
      });
    });

    describe('GET /versioning/components/versions/:versionId', () => {
      it('should return specific component version', async () => {
        const response = await request(app.getHttpServer())
          .get(`/versioning/components/versions/${componentId}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', componentId);
        expect(response.body).toHaveProperty('inputInstructions');
        expect(response.body).toHaveProperty('operationInstructions');
        expect(response.body).toHaveProperty('outputInstructions');
        expect(response.body).toHaveProperty('config');
        expect(response.body).toHaveProperty('tools');
      });

      it('should return 404 for non-existent version', async () => {
        const fakeId = randomUUID();
        await request(app.getHttpServer())
          .get(`/versioning/components/versions/${fakeId}`)
          .expect(404);
      });

      it('should include checksum information', async () => {
        const response = await request(app.getHttpServer())
          .get(`/versioning/components/versions/${componentId}`)
          .expect(200);

        expect(response.body).toHaveProperty('checksum');
        expect(response.body).toHaveProperty('checksumAlgorithm');
      });
    });

    describe('POST /versioning/components/:componentId/versions', () => {
      it('should create minor version when majorVersion not provided', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/${componentId}/versions`)
          .send({ changeDescription: 'Minor update' })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.versionMajor).toBe(1);
        expect(response.body.versionMinor).toBe(1);
        expect(response.body.changeDescription).toBe('Minor update');

        versionId = response.body.id;
      });

      it('should create major version when majorVersion provided', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/${componentId}/versions`)
          .send({ majorVersion: 2, changeDescription: 'Breaking changes' })
          .expect(201);

        expect(response.body.versionMajor).toBe(2);
        expect(response.body.versionMinor).toBe(0);
        expect(response.body.changeDescription).toBe('Breaking changes');

        await prisma.component.delete({ where: { id: response.body.id } });
      });

      it('should return 400 for invalid majorVersion', async () => {
        await request(app.getHttpServer())
          .post(`/versioning/components/${componentId}/versions`)
          .send({ majorVersion: 0 })
          .expect(400);
      });

      it('should return 400 for majorVersion <= current', async () => {
        await request(app.getHttpServer())
          .post(`/versioning/components/${componentId}/versions`)
          .send({ majorVersion: 1 })
          .expect(400);
      });

      it('should copy all fields to new version', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/${componentId}/versions`)
          .send({})
          .expect(201);

        expect(response.body.inputInstructions).toBe('Original input instructions');
        expect(response.body.operationInstructions).toBe('Original operation instructions');
        expect(response.body.outputInstructions).toBe('Original output instructions');
        expect(response.body.config.modelId).toBe('claude-3-sonnet');
        expect(response.body.tools).toEqual(['tool1', 'tool2']);

        await prisma.component.delete({ where: { id: response.body.id } });
      });
    });

    describe('POST /versioning/components/versions/:versionId/activate', () => {
      it('should activate version and deactivate others', async () => {
        // Create version 1.1
        const v11 = await versioningService.createMinorVersion('component', componentId);

        // Activate v1.1
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/versions/${v11.id}/activate`)
          .expect(200);

        expect(response.body.active).toBe(true);

        // Verify original is deactivated
        const original = await prisma.component.findUnique({
          where: { id: componentId },
        });
        expect(original?.active).toBe(false);

        // Cleanup
        await prisma.component.delete({ where: { id: v11.id } });
      });

      it('should return 404 for non-existent version', async () => {
        const fakeId = randomUUID();
        await request(app.getHttpServer())
          .post(`/versioning/components/versions/${fakeId}/activate`)
          .expect(404);
      });
    });

    describe('POST /versioning/components/versions/:versionId/deactivate', () => {
      it('should deactivate version', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/versions/${componentId}/deactivate`)
          .expect(200);

        expect(response.body.active).toBe(false);

        // Verify in database
        const component = await prisma.component.findUnique({
          where: { id: componentId },
        });
        expect(component?.active).toBe(false);

        // Restore active state for cleanup
        await prisma.component.update({
          where: { id: componentId },
          data: { active: true },
        });
      });
    });

    describe('GET /versioning/components/versions/compare', () => {
      it('should compare two versions and return diff', async () => {
        // Create modified version
        const v11 = await prisma.component.create({
          data: {
            id: randomUUID(),
            projectId: testProjectId,
            name: `${TEST_PREFIX}component_${Date.now()}`,
            parentId: componentId,
            inputInstructions: 'Modified input instructions',
            operationInstructions: 'Modified operation instructions',
            outputInstructions: 'Original output instructions',
            config: { modelId: 'claude-3-opus', temperature: 0.8 },
            tools: ['tool1', 'tool2', 'tool3'],
            version: 'v1.1',
            versionMajor: 1,
            versionMinor: 1,
            createdFromVersion: '1.0',
          },
        });

        const response = await request(app.getHttpServer())
          .get('/versioning/components/versions/compare')
          .query({ versionId1: componentId, versionId2: v11.id })
          .expect(200);

        expect(response.body).toHaveProperty('entityType', 'component');
        expect(response.body).toHaveProperty('version1');
        expect(response.body).toHaveProperty('version2');
        expect(response.body).toHaveProperty('diff');
        expect(response.body.diff).toHaveProperty('summary');
        expect(response.body.diff).toHaveProperty('changes');
        expect(response.body.diff.summary.fieldsModified).toBeGreaterThan(0);

        // Cleanup
        await prisma.component.delete({ where: { id: v11.id } });
      });

      it('should return 400 when query params missing', async () => {
        await request(app.getHttpServer())
          .get('/versioning/components/versions/compare')
          .expect(400);
      });

      it('should detect breaking changes', async () => {
        // Create version with breaking change (tool removed)
        const v20 = await prisma.component.create({
          data: {
            id: randomUUID(),
            projectId: testProjectId,
            name: `${TEST_PREFIX}component_${Date.now()}`,
            parentId: componentId,
            inputInstructions: 'Original input instructions',
            operationInstructions: 'Original operation instructions',
            outputInstructions: 'Original output instructions',
            config: { modelId: 'claude-3-sonnet', temperature: 0.7 },
            tools: ['tool1'], // Removed tool2
            version: 'v2.0',
            versionMajor: 2,
            versionMinor: 0,
            createdFromVersion: '1.0',
          },
        });

        const response = await request(app.getHttpServer())
          .get('/versioning/components/versions/compare')
          .query({ versionId1: componentId, versionId2: v20.id })
          .expect(200);

        expect(response.body.diff.impactAnalysis?.breakingChanges).toBe(true);

        // Cleanup
        await prisma.component.delete({ where: { id: v20.id } });
      });
    });

    describe('POST /versioning/components/versions/:versionId/verify-checksum', () => {
      it('should verify checksum successfully', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/components/versions/${componentId}/verify-checksum`)
          .expect(200);

        expect(response.body).toHaveProperty('verified');
        expect(response.body).toHaveProperty('expectedChecksum');
        expect(response.body).toHaveProperty('actualChecksum');
        expect(response.body).toHaveProperty('algorithm');
        expect(response.body.verified).toBe(true);
      });

      it('should detect checksum mismatch if data modified', async () => {
        // Manually modify component data without updating checksum
        const component = await prisma.component.findUnique({
          where: { id: componentId },
        });

        // Save original checksum
        const originalChecksum = component?.checksum;

        // Modify data without updating checksum
        await prisma.$executeRaw`
          UPDATE "Component"
          SET "inputInstructions" = 'Tampered data'
          WHERE id = ${componentId}::uuid
        `;

        const response = await request(app.getHttpServer())
          .post(`/versioning/components/versions/${componentId}/verify-checksum`)
          .expect(200);

        expect(response.body.verified).toBe(false);
        expect(response.body.expectedChecksum).toBe(originalChecksum);
        expect(response.body.actualChecksum).not.toBe(originalChecksum);

        // Restore original data
        await prisma.component.update({
          where: { id: componentId },
          data: { inputInstructions: 'Original input instructions' },
        });
      });
    });
  });

  // ============================================================================
  // COORDINATOR VERSIONING TESTS
  // ============================================================================

  describe('Coordinator Versioning Endpoints', () => {
    let coordinatorId: string;

    beforeEach(async () => {
      const coordinator = await prisma.component.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          name: `${TEST_PREFIX}coordinator_${Date.now()}`,
          inputInstructions: 'Coordinator input',
          operationInstructions: 'Coordinator operation',
          outputInstructions: 'Coordinator output',
          coordinatorInstructions: 'Orchestrate workflow',
          decisionStrategy: 'sequential',
          config: { modelId: 'claude-3-opus', temperature: 0.5 },
          tools: ['mcp__vibestudio__create_story'],
          tags: ['coordinator'],
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      });
      coordinatorId = coordinator.id;
    });

    afterEach(async () => {
      await prisma.component.deleteMany({
        where: { parentId: coordinatorId },
      });
      await prisma.component.delete({
        where: { id: coordinatorId },
      });
    });

    describe('GET /versioning/coordinators/:coordinatorId/versions', () => {
      it('should return version history for coordinator', async () => {
        const response = await request(app.getHttpServer())
          .get(`/versioning/coordinators/${coordinatorId}/versions`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        expect(response.body[0]).toHaveProperty('coordinatorInstructions');
        expect(response.body[0]).toHaveProperty('decisionStrategy');
      });
    });

    describe('POST /versioning/coordinators/:coordinatorId/versions', () => {
      it('should create minor version of coordinator', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/coordinators/${coordinatorId}/versions`)
          .send({ changeDescription: 'Updated orchestration logic' })
          .expect(201);

        expect(response.body.versionMajor).toBe(1);
        expect(response.body.versionMinor).toBe(1);
        expect(response.body.coordinatorInstructions).toBe('Orchestrate workflow');

        await prisma.component.delete({ where: { id: response.body.id } });
      });
    });

    describe('POST /versioning/coordinators/versions/:versionId/activate', () => {
      it('should activate coordinator version', async () => {
        const v11 = await versioningService.createMinorVersion('component', coordinatorId);

        const response = await request(app.getHttpServer())
          .post(`/versioning/coordinators/versions/${v11.id}/activate`)
          .expect(200);

        expect(response.body.active).toBe(true);

        await prisma.component.delete({ where: { id: v11.id } });
      });
    });
  });

  // ============================================================================
  // WORKFLOW VERSIONING TESTS
  // ============================================================================

  describe('Workflow Versioning Endpoints', () => {
    let coordinatorId: string;
    let workflowId: string;

    beforeEach(async () => {
      const coordinator = await prisma.component.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          name: `${TEST_PREFIX}coordinator_${Date.now()}`,
          inputInstructions: 'Input',
          operationInstructions: 'Operation',
          outputInstructions: 'Output',
          coordinatorInstructions: 'Orchestrate',
          decisionStrategy: 'sequential',
          config: { modelId: 'claude-3-sonnet' },
          tools: [],
          tags: ['coordinator'],
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      });
      coordinatorId = coordinator.id;

      const workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          coordinatorId,
          name: `${TEST_PREFIX}workflow_${Date.now()}`,
          description: 'Test workflow',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });
      workflowId = workflow.id;
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { parentId: workflowId },
      });
      await prisma.workflow.delete({
        where: { id: workflowId },
      });
      await prisma.component.delete({
        where: { id: coordinatorId },
      });
    });

    describe('GET /versioning/workflows/:workflowId/versions', () => {
      it('should return version history for workflow', async () => {
        const response = await request(app.getHttpServer())
          .get(`/versioning/workflows/${workflowId}/versions`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThanOrEqual(1);
        expect(response.body[0]).toHaveProperty('coordinatorId');
        expect(response.body[0]).toHaveProperty('triggerConfig');
      });
    });

    describe('POST /versioning/workflows/:workflowId/versions', () => {
      it('should create minor version of workflow', async () => {
        const response = await request(app.getHttpServer())
          .post(`/versioning/workflows/${workflowId}/versions`)
          .send({ changeDescription: 'Updated trigger config' })
          .expect(201);

        expect(response.body.versionMajor).toBe(1);
        expect(response.body.versionMinor).toBe(1);

        await prisma.workflow.delete({ where: { id: response.body.id } });
      });
    });

    describe('GET /versioning/workflows/versions/compare', () => {
      it('should compare workflow versions', async () => {
        const v11 = await versioningService.createMinorVersion('workflow', workflowId);

        const response = await request(app.getHttpServer())
          .get('/versioning/workflows/versions/compare')
          .query({ versionId1: workflowId, versionId2: v11.id })
          .expect(200);

        expect(response.body.entityType).toBe('workflow');

        await prisma.workflow.delete({ where: { id: v11.id } });
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should return 404 for non-existent entities', async () => {
      const fakeId = randomUUID();

      await request(app.getHttpServer())
        .get(`/versioning/components/${fakeId}/versions`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/versioning/coordinators/${fakeId}/versions`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/versioning/workflows/${fakeId}/versions`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/versioning/components/invalid-uuid/versions')
        .expect(400);
    });

    it('should return 400 for missing compare params', async () => {
      await request(app.getHttpServer())
        .get('/versioning/components/versions/compare')
        .query({ versionId1: randomUUID() })
        .expect(400);
    });

    it('should return 400 for invalid majorVersion', async () => {
      const component = await prisma.component.create({
        data: {
          id: randomUUID(),
          projectId: testProjectId,
          name: `${TEST_PREFIX}temp_${Date.now()}`,
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

      await request(app.getHttpServer())
        .post(`/versioning/components/${component.id}/versions`)
        .send({ majorVersion: -1 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/versioning/components/${component.id}/versions`)
        .send({ majorVersion: 'invalid' })
        .expect(400);

      await prisma.component.delete({ where: { id: component.id } });
    });
  });
});
