/**
 * Unit Tests for NoCacheInterceptor (ST-16 Backend Issue #1)
 *
 * Purpose: Verify that NoCacheInterceptor adds correct cache-control headers
 * to prevent stale data display after code analysis completion.
 *
 * Related Requirements:
 * - BR-1 (Real-Time Data Refresh): Must prevent API response caching
 * - AC-1: After analysis completes, metrics immediately update without manual refresh
 * - AC-5: No need for hard refresh or cache clearing
 */

import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { NoCacheInterceptor } from '../no-cache.interceptor';

describe('NoCacheInterceptor (ST-16 Unit Tests)', () => {
  let interceptor: NoCacheInterceptor;
  let mockResponse: any;
  let mockContext: ExecutionContext;
  let mockHandler: CallHandler;

  beforeEach(() => {
    interceptor = new NoCacheInterceptor();

    // Mock Express response object
    mockResponse = {
      setHeader: jest.fn(),
    };

    // Mock NestJS ExecutionContext
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    // Mock CallHandler
    mockHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    } as any;
  });

  describe('TC-ST16-U1: Cache-Control header verification', () => {
    it('should set Cache-Control header with no-cache, no-store, must-revalidate, max-age=0', (done) => {
      interceptor.intercept(mockContext, mockHandler).subscribe(() => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'no-cache, no-store, must-revalidate, max-age=0'
        );
        done();
      });
    });

    it('should set Pragma header for HTTP/1.0 compatibility', (done) => {
      interceptor.intercept(mockContext, mockHandler).subscribe(() => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
        done();
      });
    });

    it('should set Expires header to 0 for proxy servers', (done) => {
      interceptor.intercept(mockContext, mockHandler).subscribe(() => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
        done();
      });
    });

    it('should set all three headers in correct order', (done) => {
      interceptor.intercept(mockContext, mockHandler).subscribe(() => {
        expect(mockResponse.setHeader).toHaveBeenCalledTimes(3);
        const calls = mockResponse.setHeader.mock.calls;
        expect(calls[0]).toEqual(['Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0']);
        expect(calls[1]).toEqual(['Pragma', 'no-cache']);
        expect(calls[2]).toEqual(['Expires', '0']);
        done();
      });
    });
  });

  describe('TC-ST16-U2: Response passthrough', () => {
    it('should pass through response data unchanged', (done) => {
      const testData = { metrics: { score: 85 }, files: 100 };
      mockHandler.handle = jest.fn().mockReturnValue(of(testData));

      interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
        expect(result).toEqual(testData);
        done();
      });
    });

    it('should call handler exactly once', (done) => {
      interceptor.intercept(mockContext, mockHandler).subscribe(() => {
        expect(mockHandler.handle).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  describe('TC-ST16-U3: Multiple requests handling', () => {
    it('should apply headers to multiple sequential requests', (done) => {
      let requestCount = 0;

      const runRequest = () => {
        interceptor.intercept(mockContext, mockHandler).subscribe(() => {
          requestCount++;
          if (requestCount === 3) {
            expect(mockResponse.setHeader).toHaveBeenCalledTimes(9); // 3 headers × 3 requests
            done();
          }
        });
      };

      runRequest();
      runRequest();
      runRequest();
    });
  });

  describe('TC-ST16-U4: Error handling', () => {
    it('should set headers before handler errors propagate', (done) => {
      const error = new Error('Handler error');
      mockHandler.handle = jest.fn().mockReturnValue({
        pipe: jest.fn().mockImplementation((fn) => {
          // Verify headers were set before error
          expect(mockResponse.setHeader).toHaveBeenCalledTimes(3);
          throw error;
        }),
      } as any);

      try {
        interceptor.intercept(mockContext, mockHandler);
      } catch (e) {
        expect(e).toBe(error);
        done();
      }
    });
  });
});
