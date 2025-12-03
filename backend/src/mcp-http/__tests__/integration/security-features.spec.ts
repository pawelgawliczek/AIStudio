/**
 * Integration Tests for Security Features
 *
 * Tests:
 * - CSRF protection (Task 2.6)
 * - Account lockout (Task 2.7)
 * - Rate limiting (Task 2.3a)
 * - API key revocation (Task 2.4a)
 *
 * @see ST-163 Security Integration Tests
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';
import * as request from 'supertest';
import { PrismaService } from '../../../prisma/prisma.service';
import { McpHttpModule } from '../../mcp-http.module';

describe('Security Features (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let apiKey: string;
  let apiKeyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [McpHttpModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get('REDIS_CLIENT');

    // Create test API key
    const keyHash = await bcrypt.hash('proj_sec123_validkey', 10);
    const createdKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix: 'proj_sec123_',
        name: 'Security Test Key',
        projectId: 'test-project-id',
      },
    });

    apiKey = 'proj_sec123_validkey';
    apiKeyId = createdKey.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.apiKey.deleteMany({ where: { keyPrefix: 'proj_sec123_' } });
    await redis.quit();
    await app.close();
  });

  describe('CSRF Protection (Task 2.6)', () => {
    let csrfToken: string;

    beforeEach(async () => {
      // Get CSRF token
      const response = await request(app.getHttpServer())
        .get('/api/mcp/v1/csrf-token')
        .expect(200);

      csrfToken = response.body.csrfToken;
    });

    it('should reject POST /initialize without CSRF token', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(403); // Forbidden - Missing CSRF token
    });

    it('should accept POST /initialize with valid CSRF token', async () => {
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(201);
    });

    it('should reject POST /call-tool with invalid CSRF token', async () => {
      // Create session first
      const sessionResponse = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      const sessionId = sessionResponse.body.sessionId;

      // Try to call tool with wrong CSRF token
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .set('X-CSRF-Token', 'wrong-token')
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(403);
    });

    it('should not require CSRF token for GET requests', async () => {
      await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });
  });

  describe('Account Lockout (Task 2.7)', () => {
    const wrongApiKey = 'proj_sec123_wrongkey';

    beforeEach(async () => {
      // Clear any existing lockout
      await redis.del('lockout:proj_sec123_');
      await redis.del('failed-attempts:proj_sec123_');
    });

    it('should lock API key after 5 failed attempts', async () => {
      // Make 5 failed authentication attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${wrongApiKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'test-client',
            capabilities: [],
          })
          .expect(401);
      }

      // 6th attempt should return 429 (locked)
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${wrongApiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(429);

      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(response.body.error.retryAfter).toBeDefined();
    });

    it('should return 429 during lockout period', async () => {
      // Lock the account
      const lockoutUntil = Date.now() + 240000; // 4 minutes
      await redis.set('lockout:proj_sec123_', lockoutUntil.toString(), 'PX', 300000);

      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(429);

      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('should unlock API key after 5 minutes', async () => {
      // Set lockout that expired 1 second ago
      const lockoutUntil = Date.now() - 1000;
      await redis.set('lockout:proj_sec123_', lockoutUntil.toString(), 'PX', 1);

      // Wait for Redis key to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should be able to authenticate now
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      // Depending on CSRF setup, might be 201 or 403
      expect([201, 403]).toContain(response.status);
    });

    it('should reset failed attempts on successful auth', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${wrongApiKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'test-client',
            capabilities: [],
          })
          .expect(401);
      }

      // Successful authentication
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      // Failed attempts should be reset
      const failedAttempts = await redis.get('failed-attempts:proj_sec123_');
      expect(failedAttempts).toBeNull();
    });
  });

  describe('Rate Limiting (Task 2.3a)', () => {
    beforeEach(async () => {
      // Clear rate limit keys
      await redis.del('rate-limit:api-key:proj_sec123_');
      await redis.del('rate-limit:ip:127.0.0.1');
      await redis.del('rate-limit:global');
    });

    it('should enforce per-API-key rate limit (60 req/min)', async () => {
      // Set rate limit to max
      await redis.set('rate-limit:api-key:proj_sec123_', '60', 'EX', 60);

      const response = await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.error.retryAfter).toBeDefined();
    });

    it('should enforce per-IP rate limit (100 req/min)', async () => {
      await redis.set('rate-limit:ip:127.0.0.1', '100', 'EX', 60);

      await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(429);
    });

    it('should enforce per-endpoint rate limit (call-tool: 30 req/min)', async () => {
      await redis.set('rate-limit:endpoint:/api/mcp/v1/call-tool:proj_sec123_', '30', 'EX', 60);

      // Create session first
      const sessionResponse = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      const sessionId = sessionResponse.body.sessionId;

      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(429);
    });

    it('should enforce global rate limit (10,000 req/min)', async () => {
      await redis.set('rate-limit:global', '10000', 'EX', 60);

      await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(429);
    });

    it('should reset limits after TTL expires', async () => {
      await redis.set('rate-limit:api-key:proj_sec123_', '60', 'EX', 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should succeed now
      await request(app.getHttpServer())
        .get('/api/mcp/v1/list-tools')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
    });
  });

  describe('API Key Revocation (Task 2.4a)', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create session
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        });

      sessionId = response.body.sessionId;
    });

    it('should invalidate all sessions when API key revoked', async () => {
      // Revoke API key
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { revokedAt: new Date() },
      });

      // Try to use session with revoked key
      await request(app.getHttpServer())
        .post('/api/mcp/v1/call-tool')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Mcp-Session-Id', sessionId)
        .send({
          toolName: 'list_projects',
          arguments: {},
        })
        .expect(401);

      // Restore key for cleanup
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { revokedAt: null },
      });
    });

    it('should reject subsequent requests with revoked key', async () => {
      // Revoke API key
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { revokedAt: new Date() },
      });

      // Try to create new session
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(401);

      // Restore key
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { revokedAt: null },
      });
    });
  });

  describe('Combined Security Scenarios', () => {
    it('should enforce CSRF + rate limiting together', async () => {
      // Set rate limit
      await redis.set('rate-limit:api-key:proj_sec123_', '60', 'EX', 60);

      // Get CSRF token
      const csrfResponse = await request(app.getHttpServer())
        .get('/api/mcp/v1/csrf-token')
        .expect(200);

      // Try to initialize (should fail on rate limit, not CSRF)
      const response = await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('X-CSRF-Token', csrfResponse.body.csrfToken)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(429);

      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should enforce account lockout + CSRF together', async () => {
      const wrongKey = 'proj_sec123_wrongkey';

      // Make 5 failed attempts (should lock)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/mcp/v1/initialize')
          .set('Authorization', `Bearer ${wrongKey}`)
          .send({
            protocolVersion: 'mcp/1.0',
            clientInfo: 'test-client',
            capabilities: [],
          });
      }

      // Get CSRF token
      const csrfResponse = await request(app.getHttpServer())
        .get('/api/mcp/v1/csrf-token');

      // Try with correct API key but locked prefix
      // Should fail on lockout, not CSRF
      await request(app.getHttpServer())
        .post('/api/mcp/v1/initialize')
        .set('Authorization', `Bearer ${wrongKey}`)
        .set('X-CSRF-Token', csrfResponse.body.csrfToken)
        .send({
          protocolVersion: 'mcp/1.0',
          clientInfo: 'test-client',
          capabilities: [],
        })
        .expect(429);
    });
  });
});
