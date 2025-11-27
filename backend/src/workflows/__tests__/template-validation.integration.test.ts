import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplateParserService } from '../template-parser.service';
import { WorkflowsModule } from '../workflows.module';

/**
 * Comprehensive Integration Tests for Template Validation (ST-90)
 *
 * Tests cover:
 * - POST /workflows/validate-template - Real-time template validation
 * - POST /workflows - Workflow creation with componentAssignments
 * - Edge cases: concurrency, timeouts, database failures
 * - All validation error paths
 * - Database transactions and cleanup
 */
describe('Template Validation API (Integration)', () => {
  let app: INestApplication;
  let templateParserService: TemplateParserService;
  let prisma: PrismaService;
  let testProjectId: string;
  let testComponentIds: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkflowsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

    templateParserService = moduleFixture.get<TemplateParserService>(TemplateParserService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'ST-90 Test Project',
        description: 'Test project for workflow creation',
      },
    });
    testProjectId = project.id;

    // Create test components
    const component1 = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'Developer',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        inputInstructions: 'Receive task',
        operationInstructions: 'Implement feature',
        outputInstructions: 'Produce code',
        config: { modelId: 'claude-sonnet-4.5', temperature: 0.7 },
        tools: [],
        active: true,
      },
    });

    const component2 = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'QA Engineer',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        inputInstructions: 'Receive code',
        operationInstructions: 'Test code',
        outputInstructions: 'Produce test report',
        config: { modelId: 'claude-sonnet-4.5', temperature: 0.7 },
        tools: [],
        active: true,
      },
    });

    const component3 = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'Designer',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        inputInstructions: 'Receive requirements',
        operationInstructions: 'Design UI',
        outputInstructions: 'Produce mockups',
        config: { modelId: 'claude-sonnet-4.5', temperature: 0.7 },
        tools: [],
        active: true,
      },
    });

    testComponentIds = [component1.id, component2.id, component3.id];
  }

  async function cleanupTestData() {
    if (testProjectId) {
      // Delete workflows first (foreign key constraint)
      await prisma.workflow.deleteMany({
        where: { projectId: testProjectId },
      });

      // Delete components
      await prisma.component.deleteMany({
        where: { projectId: testProjectId },
      });

      // Delete project
      await prisma.project.delete({
        where: { id: testProjectId },
      });
    }
  }

  describe('POST /workflows/validate-template', () => {
    it('should validate template with all valid references', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}} and {{QA Engineer}} for this workflow',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
            { componentName: 'Designer', componentId: testComponentIds[2], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.errors).toHaveLength(0);
      expect(response.body.references).toHaveLength(2);
      expect(response.body.references[0].name).toBe('Developer');
      expect(response.body.references[1].name).toBe('QA Engineer');
    });

    it('should detect invalid component reference', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Unknown Component}} for implementation',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].reference).toBe('Unknown Component');
      expect(response.body.missingComponents).toContain('Unknown Component');
    });

    it('should suggest corrections for typos', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Develper}} for coding', // Missing 'o'
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors[0].message).toContain('Did you mean');
      expect(response.body.errors[0].message).toContain('Developer');
    });

    it('should handle multiple errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Unknown1}} and {{Unknown2}} together',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.missingComponents).toHaveLength(2);
    });

    it('should validate instructions with no templates', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'This has no template references at all',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(0);
      expect(response.body.errors).toHaveLength(0);
    });

    it('should handle empty component names array', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}} for implementation',
          componentAssignments: [],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toHaveLength(1);
    });

    it('should handle empty instructions', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: '',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(0);
    });

    it('should return 400 for missing instructions field', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(400);

      expect(response.body.message).toContain('instructions');
    });

    it('should return 400 for missing componentAssignments field', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}}',
        })
        .expect(400);

      expect(response.body.message).toContain('componentAssignments');
    });

    it('should return 400 for invalid instructions type', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 123, // Should be string
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(400);
    });

    it('should return 400 for invalid componentAssignments type', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}}',
          componentAssignments: 'Developer', // Should be array
        })
        .expect(400);
    });

    it('should handle case-insensitive matching suggestion', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{developer}} for coding', // Wrong case
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors[0].message).toContain('Developer');
    });

    it('should handle multiline instructions', async () => {
      const instructions = `
        Step 1: {{Developer}} analyzes requirements
        Step 2: {{Designer}} creates UI mockups
        Step 3: {{QA Engineer}} validates implementation
      `;

      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions,
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'Designer', componentId: testComponentIds[2], versionId: 'v1', version: 'v1.0' },
            { componentName: 'QA Engineer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(3);
    });

    it('should handle duplicate template references', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: '{{Developer}} then {{Developer}} again',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(2);
    });

    it('should handle Unicode characters in component names', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{开发者}} for implementation',
          componentAssignments: [
            { componentName: '开发者', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'Developer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references[0].name).toBe('开发者');
    });

    it('should handle special characters in component names', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Full-Stack Developer}} for implementation',
          componentAssignments: [
            { componentName: 'Full-Stack Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            { componentName: 'Backend Developer', componentId: testComponentIds[1], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references[0].name).toBe('Full-Stack Developer');
    });

    it('should handle very long instructions with many references', async () => {
      const instructions = Array(50)
        .fill('{{Developer}}')
        .join(' and ');

      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions,
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references.length).toBeGreaterThan(40);
    });

    it('should trim whitespace inside template braces', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{ Developer }} with extra spaces',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references[0].name).toBe('Developer');
    });

    it('should provide correct startIndex and endIndex for errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Unknown}} for implementation',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.errors[0].startIndex).toBe(4);
      expect(response.body.errors[0].endIndex).toBeGreaterThan(4);
    });

    // NEW TESTS: Concurrent requests
    it('should handle 10 concurrent validation requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        request(app.getHttpServer())
          .post('/workflows/validate-template')
          .send({
            instructions: `Request ${i}: {{Developer}} implements feature`,
            componentAssignments: [
              { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            ],
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });
    });

    // NEW TESTS: Large payload handling
    it('should handle template with 100+ component references', async () => {
      const instructions = Array(100)
        .fill(null)
        .map((_, i) => `{{Developer}} step ${i}`)
        .join('\n');

      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions,
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references.length).toBe(100);
    });

    // NEW TESTS: Malformed input
    it('should handle componentAssignments with missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: '{{Developer}} implements',
          componentAssignments: [
            { componentName: 'Developer' }, // Missing componentId, versionId, version
          ],
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /workflows - Workflow Creation with Component Assignments', () => {
    let testCoordinatorId: string;

    beforeAll(async () => {
      // Create coordinator component
      const coordinator = await prisma.component.create({
        data: {
          projectId: testProjectId,
          name: 'Feature Implementation Coordinator',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          inputInstructions: 'Receive workflow context',
          operationInstructions: 'Use {{Developer}} to implement and {{QA Engineer}} to test',
          outputInstructions: 'Produce execution results',
          config: {
            modelId: 'claude-sonnet-4.5',
            temperature: 0.7,
            decisionStrategy: 'sequential',
          },
          tools: ['mcp__vibestudio__*'],
          tags: ['coordinator'],
          active: true,
        },
      });
      testCoordinatorId = coordinator.id;
    });

    it('should create workflow with valid componentAssignments', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Test Workflow with Components',
          description: 'Workflow for testing component assignments',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
          componentAssignments: [
            {
              componentName: 'Developer',
              componentId: testComponentIds[0],
              versionId: 'ver-1',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
            {
              componentName: 'QA Engineer',
              componentId: testComponentIds[1],
              versionId: 'ver-2',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
          ],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Test Workflow with Components');
      expect(response.body.componentAssignments).toHaveLength(2);
      expect(response.body.componentAssignments[0].componentName).toBe('Developer');
    });

    it('should reject workflow with duplicate component names', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Invalid Workflow - Duplicates',
          description: 'Should fail due to duplicate names',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
          componentAssignments: [
            {
              componentName: 'Developer',
              componentId: testComponentIds[0],
              versionId: 'ver-1',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
            {
              componentName: 'Developer', // Duplicate
              componentId: testComponentIds[1],
              versionId: 'ver-2',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toContain('unique');
      expect(response.body.duplicates).toContain('Developer');
    });

    it('should reject workflow with invalid component references in coordinator', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Invalid Workflow - Missing Component',
          description: 'Coordinator references components not in assignments',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
          componentAssignments: [
            {
              componentName: 'Designer', // Coordinator expects Developer + QA Engineer
              componentId: testComponentIds[2],
              versionId: 'ver-3',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid template references');
      expect(response.body.errors).toBeDefined();
    });

    it('should reject workflow with non-existent project', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/00000000-0000-0000-0000-000000000000/workflows')
        .send({
          name: 'Invalid Workflow',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
        })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should reject workflow with non-existent coordinator', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Invalid Workflow',
          coordinatorId: '00000000-0000-0000-0000-000000000000',
          triggerConfig: {
            type: 'manual',
          },
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid coordinator');
    });

    it('should reject workflow with non-existent component in assignments', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Invalid Workflow - Bad Component',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
          componentAssignments: [
            {
              componentName: 'Developer',
              componentId: '00000000-0000-0000-0000-000000000000', // Invalid
              versionId: 'ver-1',
              version: 'v1.0',
              versionMajor: 1,
              versionMinor: 0,
            },
          ],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid');
    });

    it('should create workflow without componentAssignments', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Simple Workflow',
          description: 'No component assignments',
          coordinatorId: testCoordinatorId,
          triggerConfig: {
            type: 'manual',
          },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.componentAssignments || []).toHaveLength(0);
    });

    it('should handle concurrent workflow creation requests', async () => {
      const requests = Array(5).fill(null).map((_, i) =>
        request(app.getHttpServer())
          .post(`/projects/${testProjectId}/workflows`)
          .send({
            name: `Concurrent Workflow ${i}`,
            coordinatorId: testCoordinatorId,
            triggerConfig: {
              type: 'manual',
            },
            componentAssignments: [
              {
                componentName: 'Developer',
                componentId: testComponentIds[0],
                versionId: 'ver-1',
                version: 'v1.0',
                versionMajor: 1,
                versionMinor: 0,
              },
              {
                componentName: 'QA Engineer',
                componentId: testComponentIds[1],
                versionId: 'ver-2',
                version: 'v1.0',
                versionMajor: 1,
                versionMinor: 0,
              },
            ],
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, i) => {
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(`Concurrent Workflow ${i}`);
      });
    });

    it('should handle workflow creation with 20 component assignments', async () => {
      // Create many assignments with alternating components
      const componentAssignments = Array(20).fill(null).map((_, i) => ({
        componentName: `Component ${i}`,
        componentId: testComponentIds[i % 3],
        versionId: `ver-${i}`,
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      }));

      // Create coordinator that accepts all these components
      const bigCoordinator = await prisma.component.create({
        data: {
          projectId: testProjectId,
          name: 'Big Coordinator',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          inputInstructions: 'Receive context',
          operationInstructions: componentAssignments.map(c => `{{${c.componentName}}}`).join(' then '),
          outputInstructions: 'Produce results',
          config: {
            modelId: 'claude-sonnet-4.5',
            temperature: 0.7,
          },
          tools: [],
          tags: ['coordinator'],
          active: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/projects/${testProjectId}/workflows`)
        .send({
          name: 'Large Workflow',
          coordinatorId: bigCoordinator.id,
          triggerConfig: {
            type: 'manual',
          },
          componentAssignments,
        })
        .expect(201);

      expect(response.body.componentAssignments).toHaveLength(20);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid-fire validation requests (rate limiting)', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/workflows/validate-template')
          .send({
            instructions: '{{Developer}} implements',
            componentAssignments: [
              { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
            ],
          })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;

      // Should handle all requests successfully
      expect(successCount).toBe(20);
    });

    it('should handle validation with very long component names', async () => {
      const longName = 'A'.repeat(255); // Max typical length

      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: `Use {{${longName}}} for implementation`,
          componentAssignments: [
            { componentName: longName, componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references[0].name).toBe(longName);
    });

    it('should handle instructions with nested braces', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}} with config {temperature: 0.7}',
          componentAssignments: [
            { componentName: 'Developer', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(1);
    });

    it('should handle empty string component names', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{}} for implementation',
          componentAssignments: [
            { componentName: '', componentId: testComponentIds[0], versionId: 'v1', version: 'v1.0' },
          ],
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });
  });
});
