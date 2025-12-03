/**
 * Unit Tests for SSRF Validator (Task 5.4)
 *
 * Tests URL validation and SSRF prevention logic.
 *
 * @see ST-163 Task 5.4: SSRF Prevention for Tool Arguments
 */

import { BadRequestException } from '@nestjs/common';
import { validateUrl, validateToolArguments } from '../utils/ssrf-validator';

describe('SSRF Validator', () => {
  describe('validateUrl', () => {
    it('should accept valid HTTPS URL', () => {
      expect(() => validateUrl('https://example.com/api/data')).not.toThrow();
    });

    it('should accept valid HTTP URL', () => {
      expect(() => validateUrl('http://example.com/api/data')).not.toThrow();
    });

    it('should reject localhost URLs', () => {
      expect(() => validateUrl('http://localhost:3000/api')).toThrow(BadRequestException);
      expect(() => validateUrl('http://localhost:3000/api')).toThrow('Internal URLs not allowed');
    });

    it('should reject loopback IP (127.0.0.1)', () => {
      expect(() => validateUrl('http://127.0.0.1:3000/api')).toThrow(BadRequestException);
      expect(() => validateUrl('http://127.0.0.1:3000/api')).toThrow('Internal URLs not allowed');
    });

    it('should reject 0.0.0.0 addresses', () => {
      expect(() => validateUrl('http://0.0.0.0:3000/api')).toThrow(BadRequestException);
    });

    it('should reject IPv6 loopback (::1)', () => {
      expect(() => validateUrl('http://[::1]:3000/api')).toThrow(BadRequestException);
    });

    it('should reject private IP range 10.x.x.x', () => {
      expect(() => validateUrl('http://10.0.0.1/api')).toThrow(BadRequestException);
      expect(() => validateUrl('http://10.255.255.255/api')).toThrow(BadRequestException);
    });

    it('should reject private IP range 172.16.x.x - 172.31.x.x', () => {
      expect(() => validateUrl('http://172.16.0.1/api')).toThrow(BadRequestException);
      expect(() => validateUrl('http://172.31.255.255/api')).toThrow(BadRequestException);
    });

    it('should reject private IP range 192.168.x.x', () => {
      expect(() => validateUrl('http://192.168.1.1/api')).toThrow(BadRequestException);
    });

    it('should reject link-local IPv4 (169.254.x.x)', () => {
      expect(() => validateUrl('http://169.254.1.1/api')).toThrow(BadRequestException);
    });

    it('should reject IPv6 link-local (fe80:)', () => {
      expect(() => validateUrl('http://[fe80::1]/api')).toThrow(BadRequestException);
    });

    it('should reject IPv6 unique local addresses (fc00:, fd00:)', () => {
      expect(() => validateUrl('http://[fc00::1]/api')).toThrow(BadRequestException);
      expect(() => validateUrl('http://[fd00::1]/api')).toThrow(BadRequestException);
    });

    it('should reject FTP protocol', () => {
      expect(() => validateUrl('ftp://example.com/file.txt')).toThrow(BadRequestException);
      expect(() => validateUrl('ftp://example.com/file.txt')).toThrow('Only HTTP/HTTPS URLs allowed');
    });

    it('should reject file:// protocol', () => {
      expect(() => validateUrl('file:///etc/passwd')).toThrow(BadRequestException);
    });

    it('should reject gopher:// protocol', () => {
      expect(() => validateUrl('gopher://example.com')).toThrow(BadRequestException);
    });

    it('should reject invalid URL format', () => {
      expect(() => validateUrl('not a url')).toThrow(BadRequestException);
      expect(() => validateUrl('not a url')).toThrow('Invalid URL format');
    });

    it('should reject malformed URLs', () => {
      expect(() => validateUrl('http://')).toThrow(BadRequestException);
      expect(() => validateUrl('https://')).toThrow(BadRequestException);
    });
  });

  describe('validateToolArguments', () => {
    it('should accept tool arguments without URLs', () => {
      expect(() =>
        validateToolArguments('list_projects', {
          category: 'active',
          limit: 10,
        }),
      ).not.toThrow();
    });

    it('should accept tool arguments with valid HTTPS URL', () => {
      expect(() =>
        validateToolArguments('fetch_data', {
          url: 'https://api.example.com/data',
        }),
      ).not.toThrow();
    });

    it('should reject tool arguments with localhost URL', () => {
      expect(() =>
        validateToolArguments('fetch_data', {
          url: 'http://localhost:3000/admin',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject tool arguments with private IP URL', () => {
      expect(() =>
        validateToolArguments('fetch_data', {
          url: 'http://192.168.1.1/admin',
        }),
      ).toThrow(BadRequestException);
    });

    it('should validate URLs in nested objects', () => {
      expect(() =>
        validateToolArguments('complex_tool', {
          config: {
            webhookUrl: 'http://localhost:3000/webhook',
          },
        }),
      ).toThrow(BadRequestException);
    });

    it('should validate URLs in arrays', () => {
      expect(() =>
        validateToolArguments('batch_fetch', {
          urls: ['https://api.example.com/1', 'http://localhost:3000/admin'],
        }),
      ).toThrow(BadRequestException);
    });

    it('should accept valid URLs in arrays', () => {
      expect(() =>
        validateToolArguments('batch_fetch', {
          urls: ['https://api.example.com/1', 'https://api.example.com/2'],
        }),
      ).not.toThrow();
    });

    it('should accept non-URL strings that contain http/https', () => {
      expect(() =>
        validateToolArguments('create_document', {
          content: 'Visit https://example.com for more info',
          description: 'This is about http protocols',
        }),
      ).not.toThrow();
    });

    it('should handle null and undefined arguments gracefully', () => {
      expect(() => validateToolArguments('test_tool', null as any)).not.toThrow();
      expect(() => validateToolArguments('test_tool', undefined as any)).not.toThrow();
    });

    it('should handle empty arguments object', () => {
      expect(() => validateToolArguments('test_tool', {})).not.toThrow();
    });

    it('should handle non-object arguments gracefully', () => {
      expect(() => validateToolArguments('test_tool', 'string' as any)).not.toThrow();
      expect(() => validateToolArguments('test_tool', 123 as any)).not.toThrow();
    });

    it('should validate deeply nested URLs', () => {
      expect(() =>
        validateToolArguments('nested_tool', {
          level1: {
            level2: {
              level3: {
                url: 'http://127.0.0.1/secret',
              },
            },
          },
        }),
      ).toThrow(BadRequestException);
    });
  });
});
