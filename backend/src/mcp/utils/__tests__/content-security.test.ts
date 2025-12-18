/**
 * Content Security Utility Tests (ST-177)
 * TDD Approach: Tests written BEFORE implementation
 *
 * Tests for shared redaction logic extracted from TranscriptsService
 */

import { redactSensitiveData, REDACTION_PATTERNS } from '../content-security';

describe('content-security', () => {
  describe('REDACTION_PATTERNS', () => {
    it('should export redaction patterns object', () => {
      expect(REDACTION_PATTERNS).toBeDefined();
      expect(REDACTION_PATTERNS).toHaveProperty('OPENAI_KEY');
      expect(REDACTION_PATTERNS).toHaveProperty('ANTHROPIC_KEY');
      expect(REDACTION_PATTERNS).toHaveProperty('AWS_ACCESS_KEY');
      expect(REDACTION_PATTERNS).toHaveProperty('JWT');
      expect(REDACTION_PATTERNS).toHaveProperty('EMAIL');
      expect(REDACTION_PATTERNS).toHaveProperty('PASSWORD');
      expect(REDACTION_PATTERNS).toHaveProperty('SECRET');
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact OpenAI API keys', () => {
      const content = 'OPENAI_API_KEY=sk-1234567890abcdefghij1234567890AB\nOTHER=value';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-KEY]');
      expect(result.redactedContent).not.toContain('sk-1234567890');
      expect(result.redactionApplied).toBe(true);
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact Anthropic API keys', () => {
      const content = 'ANTHROPIC_KEY=sk-ant-api03-abc123xyz456_test-key\nOTHER=value';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-KEY]');
      expect(result.redactedContent).not.toContain('sk-ant-api03');
      expect(result.redactionApplied).toBe(true);
    });

    it('should redact AWS access keys', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nSECRET=test';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-KEY]');
      expect(result.redactedContent).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.redactionApplied).toBe(true);
    });

    it('should redact JWT tokens', () => {
      const content = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-KEY]');
      expect(result.redactedContent).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.redactionApplied).toBe(true);
    });

    it('should redact email addresses', () => {
      const content = 'Contact: user@example.com for support';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-EMAIL]');
      expect(result.redactedContent).not.toContain('user@example.com');
      expect(result.redactionApplied).toBe(true);
    });

    it('should redact password fields', () => {
      const content = 'password="MySecretP@ssw0rd"\nusername=admin';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-SECRET]');
      expect(result.redactedContent).not.toContain('MySecretP@ssw0rd');
      expect(result.redactionApplied).toBe(true);
    });

    it('should redact secret tokens', () => {
      const content = 'api_key="ghp_1234567890abcdefghijklmnopqrstuv"\napp=test';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-SECRET]');
      expect(result.redactedContent).not.toContain('ghp_1234567890');
      expect(result.redactionApplied).toBe(true);
    });

    it('should handle content with no sensitive data', () => {
      const content = '# Implementation Plan\n\nThis is a safe document.';
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toBe(content);
      expect(result.redactionApplied).toBe(false);
      expect(result.redactionCount).toBe(0);
    });

    it('should redact multiple patterns in single content', () => {
      const content = `
        OPENAI_KEY=sk-1234567890abcdefghij1234567890AB
        EMAIL=admin@example.com
        password="secret123"
      `;
      const result = redactSensitiveData(content);

      expect(result.redactedContent).toContain('[REDACTED-KEY]');
      expect(result.redactedContent).toContain('[REDACTED-EMAIL]');
      expect(result.redactedContent).toContain('[REDACTED-SECRET]');
      expect(result.redactionCount).toBeGreaterThanOrEqual(3);
    });

    it('should return list of patterns that matched', () => {
      const content = 'OPENAI_KEY=sk-1234567890abcdefghij1234567890ABCDEF\nEMAIL=user@test.com';
      const result = redactSensitiveData(content);

      expect(result.patterns).toContain('OPENAI_KEY');
      expect(result.patterns).toContain('EMAIL');
    });

    it('should handle empty content', () => {
      const result = redactSensitiveData('');

      expect(result.redactedContent).toBe('');
      expect(result.redactionApplied).toBe(false);
      expect(result.redactionCount).toBe(0);
    });

    it('should handle null/undefined gracefully', () => {
      const result1 = redactSensitiveData(null as any);
      const result2 = redactSensitiveData(undefined as any);

      expect(result1.redactedContent).toBe('');
      expect(result2.redactedContent).toBe('');
    });
  });
});
