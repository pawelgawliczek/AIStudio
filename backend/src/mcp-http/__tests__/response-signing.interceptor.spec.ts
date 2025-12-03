/**
 * Unit Tests for Response Signing Interceptor (Task 5.3)
 *
 * Tests HMAC response signing functionality.
 *
 * @see ST-163 Task 5.3: Response Signing with HMAC
 */

import * as crypto from 'crypto';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseSigningInterceptor } from '../interceptors/response-signing.interceptor';

describe('ResponseSigningInterceptor', () => {
  let interceptor: ResponseSigningInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockResponse: any;

  beforeEach(() => {
    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
    };

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as any;

    // Mock call handler
    mockCallHandler = {
      handle: jest.fn(() => of({ success: true, data: 'test' })),
    } as any;
  });

  afterEach(() => {
    // Clear environment variables
    delete process.env.HMAC_SECRET;
  });

  describe('when HMAC_SECRET is configured', () => {
    beforeEach(() => {
      process.env.HMAC_SECRET = 'test-secret-key';
      interceptor = new ResponseSigningInterceptor();
    });

    it('should add X-Signature header to response', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Signature', expect.any(String));
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Signature-Algorithm', 'HMAC-SHA256');
        done();
      });
    });

    it('should generate correct HMAC signature', (done) => {
      const responseData = { success: true, data: 'test' };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((data) => {
        expect(data).toEqual(responseData);

        // Verify signature is correct
        const expectedSignature = crypto
          .createHmac('sha256', 'test-secret-key')
          .update(JSON.stringify(responseData))
          .digest('hex');

        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Signature', expectedSignature);
        done();
      });
    });

    it('should generate different signatures for different data', (done) => {
      const firstData = { success: true, data: 'test1' };
      const secondData = { success: true, data: 'test2' };

      // First call
      mockCallHandler.handle = jest.fn(() => of(firstData));
      const firstInterceptor = new ResponseSigningInterceptor();

      firstInterceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
        const firstSignature = (mockResponse.setHeader as jest.Mock).mock.calls.find(
          (call) => call[0] === 'X-Signature',
        )?.[1];

        // Reset mock
        mockResponse.setHeader.mockClear();

        // Second call with different data
        mockCallHandler.handle = jest.fn(() => of(secondData));
        const secondInterceptor = new ResponseSigningInterceptor();

        secondInterceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
          const secondSignature = (mockResponse.setHeader as jest.Mock).mock.calls.find(
            (call) => call[0] === 'X-Signature',
          )?.[1];

          expect(firstSignature).not.toEqual(secondSignature);
          done();
        });
      });
    });

    it('should not throw error if signature generation fails', (done) => {
      // Mock a scenario where JSON.stringify fails
      const circularObj: any = {};
      circularObj.self = circularObj; // Create circular reference

      mockCallHandler.handle = jest.fn(() => of(circularObj));

      // Should not throw
      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
          done();
        });
      }).not.toThrow();
    });
  });

  describe('when HMAC_SECRET is not configured', () => {
    beforeEach(() => {
      delete process.env.HMAC_SECRET;
      interceptor = new ResponseSigningInterceptor();
    });

    it('should not add X-Signature header when HMAC_SECRET is undefined', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
        expect(mockResponse.setHeader).not.toHaveBeenCalledWith('X-Signature', expect.any(String));
        done();
      });
    });

    it('should still return response data', (done) => {
      const responseData = { success: true, data: 'test' };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((data) => {
        expect(data).toEqual(responseData);
        done();
      });
    });
  });

  describe('signature verification', () => {
    beforeEach(() => {
      process.env.HMAC_SECRET = 'test-secret-key';
      interceptor = new ResponseSigningInterceptor();
    });

    it('should generate verifiable signature', (done) => {
      const responseData = { success: true, message: 'Hello World' };
      mockCallHandler.handle = jest.fn(() => of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe(() => {
        const signature = (mockResponse.setHeader as jest.Mock).mock.calls.find(
          (call) => call[0] === 'X-Signature',
        )?.[1];

        // Client-side verification
        const verifiedSignature = crypto
          .createHmac('sha256', 'test-secret-key')
          .update(JSON.stringify(responseData))
          .digest('hex');

        expect(signature).toEqual(verifiedSignature);
        done();
      });
    });
  });
});
