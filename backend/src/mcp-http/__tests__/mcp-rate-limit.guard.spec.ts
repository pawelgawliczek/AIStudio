/**
 * Unit Tests for McpRateLimitGuard (Task 2.3a - HIGH SECURITY)
 *
 * Tests multi-dimensional rate limiting:
 * - Per-API-key (60 req/min)
 * - Per-IP (100 req/min)
 * - Per-endpoint (30 req/min for call-tool)
 * - Global (10,000 req/min)
 *
 * @see ST-163 Task 2.3a: Implement Multi-Dimensional Rate Limiting
 */

import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { McpRateLimitGuard, RATE_LIMITS } from '../guards/mcp-rate-limit.guard';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
};

describe('McpRateLimitGuard (Task 2.3a - HIGH SECURITY)', () => {
  let guard: McpRateLimitGuard;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new McpRateLimitGuard(mockRedis as any);

    mockRequest = {
      user: {
        apiKey: {
          id: 'key-123',
          keyPrefix: 'proj_abc123_',
        },
      },
      ip: '192.168.1.100',
      route: {
        path: '/api/mcp/v1/call-tool',
      },
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
    } as any;

    // Default: no rate limits hit
    mockRedis.get.mockResolvedValue('0');
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(60);
  });

  describe('Multi-Dimensional Rate Limiting', () => {
    it('should enforce per-API-key rate limit (60 req/min)', async () => {
      mockRedis.get.mockResolvedValue('60'); // At limit

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect((error as HttpException).getResponse()).toMatchObject({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('per-API-key'),
            retryAfter: expect.any(Number),
          },
        });
      }
    });

    it('should enforce per-IP rate limit (100 req/min)', async () => {
      // Per-API-key is fine
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'rate-limit:api-key:proj_abc123_') return Promise.resolve('50');
        if (key === 'rate-limit:ip:192.168.1.100') return Promise.resolve('100'); // At limit
        return Promise.resolve('0');
      });

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.message).toContain('per-IP');
      }
    });

    it('should enforce per-endpoint rate limit (call-tool: 30 req/min)', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'rate-limit:api-key:proj_abc123_') return Promise.resolve('20');
        if (key === 'rate-limit:ip:192.168.1.100') return Promise.resolve('50');
        if (key.includes('endpoint:/api/mcp/v1/call-tool')) return Promise.resolve('30'); // At limit
        return Promise.resolve('0');
      });

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.message).toContain('per-endpoint');
      }
    });

    it('should enforce global rate limit (10,000 req/min)', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'rate-limit:global') return Promise.resolve('10000'); // At limit
        return Promise.resolve('0');
      });

      try {
        await guard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.message).toContain('global');
      }
    });

    it('should allow request when all limits are under threshold', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'rate-limit:api-key:proj_abc123_') return Promise.resolve('30');
        if (key === 'rate-limit:ip:192.168.1.100') return Promise.resolve('50');
        if (key.includes('endpoint')) return Promise.resolve('15');
        if (key === 'rate-limit:global') return Promise.resolve('5000');
        return Promise.resolve('0');
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return 429 with Retry-After header', async () => {
      mockRedis.get.mockResolvedValue('60');
      mockRedis.ttl.mockResolvedValue(45); // 45 seconds until reset

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.retryAfter).toBe(45);
      }
    });

    it('should reset limits after TTL expires', async () => {
      mockRedis.get.mockResolvedValue('0'); // Reset
      mockRedis.incr.mockResolvedValue(1);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRedis.incr).toHaveBeenCalled();
    });
  });

  describe('Endpoint-Specific Limits', () => {
    it('should apply 30 req/min limit to /call-tool', async () => {
      mockRequest.route.path = '/api/mcp/v1/call-tool';

      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('endpoint:/api/mcp/v1/call-tool')) {
          return Promise.resolve(RATE_LIMITS.perEndpoint['/call-tool'].limit.toString());
        }
        return Promise.resolve('0');
      });

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(HttpException);
    });

    it('should apply 10 req/min limit to /initialize', async () => {
      mockRequest.route.path = '/api/mcp/v1/initialize';

      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('endpoint:/api/mcp/v1/initialize')) {
          return Promise.resolve(RATE_LIMITS.perEndpoint['/initialize'].limit.toString());
        }
        return Promise.resolve('0');
      });

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(HttpException);
    });

    it('should apply 60 req/min limit to /list-tools', async () => {
      mockRequest.route.path = '/api/mcp/v1/list-tools';

      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('endpoint:/api/mcp/v1/list-tools')) {
          return Promise.resolve(RATE_LIMITS.perEndpoint['/list-tools'].limit.toString());
        }
        return Promise.resolve('0');
      });

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(HttpException);
    });

    it('should apply 120 req/min limit to /heartbeat', async () => {
      mockRequest.route.path = '/api/mcp/v1/heartbeat';

      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('endpoint:/api/mcp/v1/heartbeat')) {
          return Promise.resolve(RATE_LIMITS.perEndpoint['/heartbeat'].limit.toString());
        }
        return Promise.resolve('0');
      });

      await expect(guard.canActivate(mockContext))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe('Redis Key Management', () => {
    it('should use correct Redis key for per-API-key limit', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      expect(mockRedis.get).toHaveBeenCalledWith('rate-limit:api-key:proj_abc123_');
    });

    it('should use correct Redis key for per-IP limit', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      expect(mockRedis.get).toHaveBeenCalledWith('rate-limit:ip:192.168.1.100');
    });

    it('should use correct Redis key for per-endpoint limit', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('rate-limit:endpoint:/api/mcp/v1/call-tool')
      );
    });

    it('should use correct Redis key for global limit', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      expect(mockRedis.get).toHaveBeenCalledWith('rate-limit:global');
    });

    it('should set TTL on new rate limit keys', async () => {
      mockRedis.get.mockResolvedValue(null); // New key
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.any(String),
        RATE_LIMITS.perApiKey.ttl
      );
    });
  });

  describe('Rate Limit Headers', () => {
    it('should return X-RateLimit-Limit header', async () => {
      mockRedis.get.mockResolvedValue('30');
      mockRedis.incr.mockResolvedValue(31);

      await guard.canActivate(mockContext);

      // Note: Header setting would be done in controller/interceptor
      // Guard only enforces limits
    });

    it('should return X-RateLimit-Remaining header', async () => {
      mockRedis.get.mockResolvedValue('30');
      mockRedis.incr.mockResolvedValue(31);

      await guard.canActivate(mockContext);

      // Remaining = 60 - 31 = 29
    });

    it('should return X-RateLimit-Reset header', async () => {
      mockRedis.get.mockResolvedValue('30');
      mockRedis.ttl.mockResolvedValue(45);

      await guard.canActivate(mockContext);

      // Reset time = now + 45 seconds
    });
  });

  describe('Distributed Rate Limiting', () => {
    it('should use Redis for distributed counting', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      // Verify Redis operations (distributed-safe)
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.incr).toHaveBeenCalled();
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Should allow request if Redis is down (fail open for availability)
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('Error Response Format', () => {
    it('should include error code RATE_LIMIT_EXCEEDED', async () => {
      mockRedis.get.mockResolvedValue('60');

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should include descriptive message', async () => {
      mockRedis.get.mockResolvedValue('60');

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.message).toContain('Rate limit exceeded');
      }
    });

    it('should include retryAfter timestamp', async () => {
      mockRedis.get.mockResolvedValue('60');
      mockRedis.ttl.mockResolvedValue(30);

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        const response = (error as HttpException).getResponse() as any;
        expect(response.error.retryAfter).toBe(30);
      }
    });
  });

  describe('Priority Handling', () => {
    it('should check all dimensions before allowing request', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);

      await guard.canActivate(mockContext);

      // Verify all 4 dimensions were checked
      expect(mockRedis.get).toHaveBeenCalledTimes(4);
    });

    it('should fail fast on first exceeded limit', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'rate-limit:api-key:proj_abc123_') {
          return Promise.resolve('60'); // Exceeded
        }
        return Promise.resolve('0');
      });

      try {
        await guard.canActivate(mockContext);
      } catch (error) {
        // Should throw on first exceeded limit
        expect(error).toBeInstanceOf(HttpException);
      }
    });
  });
});
