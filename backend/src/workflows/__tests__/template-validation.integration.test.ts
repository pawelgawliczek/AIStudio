import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { WorkflowsModule } from '../workflows.module';
import { TemplateParserService } from '../template-parser.service';

describe('Template Validation API (Integration)', () => {
  let app: INestApplication;
  let templateParserService: TemplateParserService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkflowsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

    templateParserService = moduleFixture.get<TemplateParserService>(TemplateParserService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /workflows/validate-template', () => {
    it('should validate template with all valid references', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}} and {{QA Engineer}} for this workflow',
          componentNames: ['Developer', 'QA Engineer', 'Designer'],
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
          componentNames: ['Developer', 'QA Engineer'],
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
          componentNames: ['Developer', 'QA Engineer'],
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
          componentNames: ['Developer'],
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
          componentNames: ['Developer', 'QA Engineer'],
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
          componentNames: [],
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
          componentNames: ['Developer'],
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.references).toHaveLength(0);
    });

    it('should return 400 for missing instructions field', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          componentNames: ['Developer'],
        })
        .expect(400);

      expect(response.body.message).toContain('instructions');
    });

    it('should return 400 for missing componentNames field', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}}',
        })
        .expect(400);

      expect(response.body.message).toContain('componentNames');
    });

    it('should return 400 for invalid instructions type', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 123, // Should be string
          componentNames: ['Developer'],
        })
        .expect(400);
    });

    it('should return 400 for invalid componentNames type', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{Developer}}',
          componentNames: 'Developer', // Should be array
        })
        .expect(400);
    });

    it('should handle case-insensitive matching suggestion', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflows/validate-template')
        .send({
          instructions: 'Use {{developer}} for coding', // Wrong case
          componentNames: ['Developer', 'QA Engineer'],
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
          componentNames: ['Developer', 'Designer', 'QA Engineer'],
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
          componentNames: ['Developer'],
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
          componentNames: ['开发者', 'Developer'],
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
          componentNames: ['Full-Stack Developer', 'Backend Developer'],
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
          componentNames: ['Developer'],
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
          componentNames: ['Developer'],
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
          componentNames: ['Developer'],
        })
        .expect(200);

      expect(response.body.errors[0].startIndex).toBe(4);
      expect(response.body.errors[0].endIndex).toBeGreaterThan(4);
    });
  });
});
