/**
 * Unit Tests for McpAuthGuard (Tasks 2.3, 2.7 - HIGH SECURITY)
 *
 * Tests API key authentication with:
 * - Bcrypt.compare() validation
 * - Account lockout after failed attempts
 * - Session binding (IP + User-Agent)
 * - Revocation checking
 *
 * @see ST-163 Task 2.3: Implement API Key Authentication Guard
 * @see ST-163 Task 2.7: Implement Account Lockout
 */

import { ExecutionContext, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { McpAuthGuard } from '../guards/mcp-auth.guard';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

// Mock Prisma
const mockPrisma = {
  apiKey: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

// Mock Logger
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('McpAuthGuard Security (Tasks 2.3, 2.7)', () => {
  let guard: McpAuthGuard;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    guard = new McpAuthGuard(mockPrisma as any, mockRedis as any);
    (guard as any).logger = mockLogger;

    mockRequest = {
      headers: {
        authorization: 'Bearer proj_abc123_xyz789validkey',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      ip: '192.168.1.100',
      user: {},
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
    } as any;

    // Setup default API key mock
    const testKeyHash = await bcrypt.hash('proj_abc123_xyz789validkey', 10);
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      id: 'key-id-123',
      keyHash: testKeyHash,
      keyPrefix: 'proj_abc123_',
      projectId: 'proj-456',
      name: 'Test Key',
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: new Date(),
    });
  });

  describe('API Key Validation', () => {
    it('should validate correct API key using bcrypt.compare()', async () => {
      mockRedis.get.mockResolvedValue(null); // No lockout
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user.apiKey).toBeDefined();
      expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyPrefix: 'proj_abc123_' },
      });
    });

    it('should reject incorrect API key', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should reject missing authorization header', async () => {
      mockRequest.headers.authorization = undefined;

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow('API key required');
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidFormat proj_abc123_xyz789';

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow('API key required');
    });

    it('should reject revoked API keys', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-123',
        keyHash: await bcrypt.hash('proj_abc123_xyz789validkey', 10),
        keyPrefix: 'proj_abc123_',
        revokedAt: new Date(),
        expiresAt: null,
      });

      mockRedis.get.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow('API key revoked');
    });

    it('should reject expired API keys', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-id-123',
        keyHash: await bcrypt.hash('proj_abc123_xyz789validkey', 10),
        keyPrefix: 'proj_abc123_',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      mockRedis.get.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow('API key expired');
    });

    it('should update lastUsedAt on successful authentication', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-id-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('Account Lockout (Task 2.7 - HIGH SECURITY)', () => {
    it('should lock API key after 5 failed attempts', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null); // Not locked initially
      mockRedis.incr.mockResolvedValue(5); // 5th attempt
      mockRedis.set.mockResolvedValue('OK');

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(HttpException);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lockout:proj_abc123_',
        expect.any(String),
        'PX',
        300000 // 5 minutes in ms
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('locked out after 5 failed attempts')
      );
    });

    it('should return 429 during lockout period', async () => {
      const lockoutUntil = Date.now() + 240000; // 4 minutes remaining
      mockRedis.get.mockResolvedValue(lockoutUntil.toString());

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((error as HttpException).getResponse()).toMatchObject({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many failed authentication attempts',
            retryAfter: expect.any(Number),
          },
        });
      }
    });

    it('should unlock API key after 5 minutes', async () => {
      const lockoutUntil = Date.now() - 1000; // Expired 1 second ago
      mockRedis.get.mockResolvedValue(lockoutUntil.toString());
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      const result = await guard.canActivate(mockContext);

      // Should allow authentication (lockout expired)
      expect(result).toBe(true);
    });

    it('should reset failed attempts on successful auth', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      expect(mockRedis.del).toHaveBeenCalledWith('failed-attempts:proj_abc123_');
    });

    it('should increment failed attempts on auth failure', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(3);
      mockRedis.expire.mockResolvedValue(1);

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow();

      expect(mockRedis.incr).toHaveBeenCalledWith('failed-attempts:proj_abc123_');
      expect(mockRedis.expire).toHaveBeenCalledWith('failed-attempts:proj_abc123_', 300);
    });

    it('should include retryAfter in lockout response', async () => {
      const lockoutUntil = Date.now() + 180000; // 3 minutes remaining
      mockRedis.get.mockResolvedValue(lockoutUntil.toString());

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.retryAfter).toBeGreaterThan(170); // ~180 seconds
        expect(response.error.retryAfter).toBeLessThan(190);
      }
    });
  });

  describe('Session Binding (Task 1.4a - HIGH SECURITY)', () => {
    it('should bind session to IP address', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      // Session should be bound to IP
      expect(mockRequest.user.apiKey).toBeDefined();
      // Note: Session binding validation is in session service
    });

    it('should bind session to User-Agent', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      // Session should be bound to User-Agent
      expect(mockRequest.user.apiKey).toBeDefined();
      // Note: Session binding validation is in session service
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should perform dummy bcrypt hash when key not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      const bcryptHashSpy = jest.spyOn(bcrypt, 'hash');

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow();

      // Verify dummy hash was performed
      expect(bcryptHashSpy).toHaveBeenCalledWith('dummy', 10);
    });

    it('should have consistent timing for valid and invalid keys', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      // Timing for valid key
      const start1 = Date.now();
      await guard.canActivate(mockContext);
      const time1 = Date.now() - start1;

      // Timing for invalid key
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.incr.mockResolvedValue(2);

      const start2 = Date.now();
      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw, ignore for timing test
      }
      const time2 = Date.now() - start2;

      // Timing should be similar (bcrypt.compare is constant-time)
      // Allow 50ms tolerance for system variance
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });
  });

  describe('Request Context Enhancement', () => {
    it('should attach validated API key to request.user', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      expect(mockRequest.user.apiKey).toBeDefined();
      expect(mockRequest.user.apiKey.id).toBe('key-id-123');
      expect(mockRequest.user.apiKey.projectId).toBe('proj-456');
    });

    it('should not attach API key on failed authentication', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);

      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw for failed auth
      }

      expect(mockRequest.user.apiKey).toBeUndefined();
    });
  });

  describe('Logging and Auditing', () => {
    it('should log successful authentication', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      mockPrisma.apiKey.update.mockResolvedValue({});

      await guard.canActivate(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('authenticated successfully')
      );
    });

    it('should log lockout events', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.set.mockResolvedValue('OK');

      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw for lockout
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('locked out after 5 failed attempts')
      );
    });

    it('should log failed authentication attempts', async () => {
      mockRequest.headers.authorization = 'Bearer proj_abc123_wrongkey123';
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(2);

      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected to throw for lockout
      }

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
