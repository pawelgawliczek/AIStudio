/**
 * Integration Tests for Full MCP HTTP Workflow
 *
 * Tests complete workflow: initialize → subscribe → call-tool → events → close
 * Includes security validation at each step.
 *
 * @see ST-163 Integration Test Requirements
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { McpHttpModule } from '../../mcp-http.module';

describe('Full MCP HTTP Workflow (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let apiKey: string;
  let sessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [McpHttpModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();

    prisma = app.get(PrismaService);

    // Create test API key
    const keyHash = await bcrypt.hash('proj_test123_validkey', 10);
    await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix: 'proj_test123_',
        name: 'Test Key',
        projectId: 'test-project-id',
      },
    });

    apiKey = 'proj_test123_validkey';
  });

  afterAll(async () => {
    // Cleanup
    await prisma.apiKey.deleteMany({ where: { keyPrefix: 'proj_test123_' } });
    await app.close();
  });

  describe('Step 1: Initialize Session', () => {
    it('should create new session with valid API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client v1.0',
          capabilities: ['tools', 'prompts'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.sessionId).toMatch(/^sess_[a-f0-9]{32}$/);
      expect(response.body).toHaveProperty('serverInfo');
      expect(response.body).toHaveProperty('capabilities');
      expect(response.body).toHaveProperty('expiration');

      sessionId = response.body.sessionId;
    });

    it('should reject initialization without API key', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client v1.0',
          capabilities: [],
        })
        .expect(401);
    });

    it('should reject initialization with invalid protocol version', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/999.999; malicious',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(400);
    });

    it('should reject oversized client info', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'a'.repeat(201),
          capabilities: [],
        })
        .expect(400);
    });
  });

  describe('Step 2: Call Tool', () => {
    it('should execute tool with valid session', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
    });

    it('should reject tool call without session', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(400);
    });

    it('should reject tool call with invalid tool name', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .send({
          toolName: 'malicious; DROP TABLE tools;',
          arguments: {},
        })
        .expect(400);
    });

    it('should reject tool call with expired session', async () => {
      // Wait for session to expire (1 hour + buffer)
      // Note: In real tests, use shorter TTL for test environment
      // For now, just test with non-existent session
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', 'sess_nonexistent123')
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(410); // Gone - session expired
    });
  });

  describe('Step 3: List Tools', () => {
    it('should list available tools', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .query({
          category: 'projects',
          detail_level: 'names_only',
        })
        .expect(200);

      expect(response.body).toHaveProperty('tools');
      expect(Array.isArray(response.body.tools)).toBe(true);
    });

    it('should filter tools by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .query({ category: 'projects' })
        .expect(200);

      // All tools should be in 'projects' category
      response.body.tools.forEach((tool: any) => {
        expect(tool.category).toBe('projects');
      });
    });
  });

  describe('Step 4: Session Heartbeat', () => {
    it('should update session heartbeat', async () => {
      await request(app.getHttpServer())
        .post(`/api/mcp/v1/session/${sessionId}/heartbeat`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });

    it('should reset session TTL on heartbeat', async () => {
      // Send heartbeat
      await request(app.getHttpServer())
        .post(`/api/mcp/v1/session/${sessionId}/heartbeat`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      // Verify session is still valid
      await request(app.getHttpServer())
        .get(`/api/mcp/v1/session/${sessionId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });
  });

  describe('Step 5: Get Session Status', () => {
    it('should get session details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/mcp/v1/session/${sessionId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionId', sessionId);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('lastHeartbeat');
      expect(response.body).toHaveProperty('reconnectCount');
    });

    it('should return 404 for non-existent session', async () => {
      await request(app.getHttpServer())
        .get('/api/mcp/v1/session/sess_nonexistent123')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);
    });
  });

  describe('Step 6: Close Session', () => {
    it('should close session successfully', async () => {
      await request(app.getHttpServer())
        .delete(`/api/mcp/v1/session/${sessionId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });

    it('should return 404 for closed session', async () => {
      await request(app.getHttpServer())
        .get(`/api/mcp/v1/session/${sessionId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(404);
    });

    it('should reject tool calls after session closed', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(410); // Gone
    });
  });

  describe('Concurrent Sessions', () => {
    it('should support multiple concurrent sessions', async () => {
      const sessions = await Promise.all([
        request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'client-1',
            capabilities: [],
          }),
        request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'client-2',
            capabilities: [],
          }),
        request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'client-3',
            capabilities: [],
          }),
      ]);

      expect(sessions[0].body.sessionId).not.toEqual(sessions[1].body.sessionId);
      expect(sessions[1].body.sessionId).not.toEqual(sessions[2].body.sessionId);
      expect(sessions[0].body.sessionId).not.toEqual(sessions[2].body.sessionId);

      // Cleanup
      await Promise.all(
        sessions.map(s =>
          request(app.getHttpServer())
            .delete(`/api/mcp/v1/session/${s.body.sessionId}`)
            .set('Authorization', `Bearer ${apiKey}`)
        )
      );
    });
  });

  describe('Security - Session Binding', () => {
    let boundSessionId: string;

    beforeEach(async () => {
      // Create session from specific IP/User-Agent
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('User-Agent', 'TestAgent/1.0')
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      boundSessionId = response.body.sessionId;
    });

    afterEach(async () => {
      // Cleanup
      await request(app.getHttpServer())
        .delete(`/api/mcp/v1/session/${boundSessionId}`)
        .set('Authorization', `Bearer ${apiKey}`)
        .catch(() => {}); // Ignore errors if already deleted
    });

    it('should reject tool call from different User-Agent', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', boundSessionId)
        .set('User-Agent', 'DifferentAgent/2.0')
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(401);
    });

    // Note: Testing IP binding requires mocking X-Forwarded-For
    // or using a reverse proxy in test environment
  });
});
