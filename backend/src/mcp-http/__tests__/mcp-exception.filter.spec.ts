/**
 * Unit Tests for McpExceptionFilter (Task 1.8 - CRITICAL SECURITY)
 *
 * Tests GlobalExceptionFilter to prevent information leakage.
 * Ensures production errors are sanitized while development errors are detailed.
 *
 * @see ST-163 Task 1.8: Implement GlobalExceptionFilter
 */

import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { McpExceptionFilter } from '../filters/mcp-exception.filter';

describe('McpExceptionFilter (Task 1.8 - CRITICAL)', () => {
  let filter: McpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new McpExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/mcp/v1/call-tool',
      method: 'POST',
      ip: '192.168.1.100',
      body: { sessionId: 'sess-123' },
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  describe('Error Handling Security', () => {
    it('should return generic error message in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new HttpException('Database connection failed', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred',
          details: undefined,
          timestamp: expect.any(String),
          path: '/api/mcp/v1/call-tool',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should return detailed error message in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new HttpException('Database connection failed', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.message).toBe('Database connection failed');
      expect(response.error.details).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not leak stack traces in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new Error('Internal error with sensitive info');
      exception.stack = 'Error: Internal error\n    at /var/app/src/sensitive-file.ts:42\n    at /var/app/config/database.ts:123';

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.details).toBeUndefined();
      expect(JSON.stringify(response)).not.toContain('/var/app');
      expect(JSON.stringify(response)).not.toContain('sensitive-file.ts');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error code and timestamp', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBeDefined();
      expect(response.error.timestamp).toBeDefined();
      expect(new Date(response.error.timestamp)).toBeInstanceOf(Date);
    });

    it('should log full error details server-side', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');

      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      exception.stack = 'Error: Test error\n    at test.ts:10';

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith({
        message: 'Test error',
        stack: expect.stringContaining('Error: Test error'),
        url: '/api/mcp/v1/call-tool',
        method: 'POST',
        ip: '192.168.1.100',
        sessionId: 'sess-123',
      });
    });
  });

  describe('Error Code Mapping', () => {
    it('should map UNAUTHORIZED status to code', () => {
      const exception = new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBe('UNAUTHORIZED');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    });

    it('should map FORBIDDEN status to code', () => {
      const exception = new HttpException('Access denied', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBe('FORBIDDEN');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });

    it('should map NOT_FOUND status to code', () => {
      const exception = new HttpException('Session not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBe('NOT_FOUND');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should map TOO_MANY_REQUESTS to RATE_LIMIT_EXCEEDED code', () => {
      const exception = new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should map unknown errors to INTERNAL_ERROR', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.code).toBe('INTERNAL_ERROR');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Generic Error Messages (Production)', () => {
    beforeEach(() => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = originalEnv;
    });

    it('should return generic message for UNAUTHORIZED', () => {
      process.env.NODE_ENV = 'production';
      const exception = new HttpException('Invalid credentials for user admin', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.message).toBe('Authentication failed');
      expect(response.error.message).not.toContain('admin');
    });

    it('should return generic message for FORBIDDEN', () => {
      process.env.NODE_ENV = 'production';
      const exception = new HttpException('User lacks role: admin', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.message).toBe('Access denied');
      expect(response.error.message).not.toContain('role');
    });

    it('should return generic message for INTERNAL_SERVER_ERROR', () => {
      process.env.NODE_ENV = 'production';
      const exception = new Error('Database connection to postgres://user:pass@host failed');

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.message).toBe('An error occurred');
      expect(response.error.message).not.toContain('postgres://');
      expect(response.error.message).not.toContain('password');
    });
  });

  describe('Request Context Logging', () => {
    it('should log session ID from request body', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');

      mockRequest.body = { sessionId: 'sess-abc-123' };

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-abc-123' })
      );
    });

    it('should log session ID from request params', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');

      mockRequest.body = {};
      mockRequest.params = { id: 'sess-xyz-789' };

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-xyz-789' })
      );
    });

    it('should log request URL and method', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');

      mockRequest.url = '/api/mcp/v1/session/123';
      mockRequest.method = 'DELETE';

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/mcp/v1/session/123',
          method: 'DELETE',
        })
      );
    });

    it('should log client IP address', () => {
      const loggerSpy = jest.spyOn((filter as any).logger, 'error');

      mockRequest.ip = '10.0.0.50';

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '10.0.0.50' })
      );
    });
  });

  describe('Response Format', () => {
    it('should always include error object wrapper', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(response.error).toHaveProperty('timestamp');
      expect(response.error).toHaveProperty('path');
    });

    it('should include path in error response', () => {
      mockRequest.url = '/api/mcp/v1/call-tool';

      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      expect(response.error.path).toBe('/api/mcp/v1/call-tool');
    });

    it('should use ISO 8601 timestamp format', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const response = mockResponse.json.mock.calls[0][0];

      // Verify ISO 8601 format
      expect(response.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(response.error.timestamp)).toBeInstanceOf(Date);
    });
  });
});
