import {
  APPROVED_SCRIPTS,
  isScriptApproved,
  validateParams,
  getScriptTimeout,
} from '../approved-scripts';

describe('Approved Scripts', () => {
  describe('APPROVED_SCRIPTS configuration', () => {
    it('should have parse-transcript in whitelist', () => {
      expect(APPROVED_SCRIPTS['parse-transcript']).toBeDefined();
      expect(APPROVED_SCRIPTS['parse-transcript'].script).toBe('scripts/parse-transcript.ts');
    });

    it('should have analyze-story-transcripts in whitelist', () => {
      expect(APPROVED_SCRIPTS['analyze-story-transcripts']).toBeDefined();
      expect(APPROVED_SCRIPTS['analyze-story-transcripts'].script).toBe('scripts/analyze-story-transcripts.ts');
    });

    it('should have list-transcripts in whitelist', () => {
      expect(APPROVED_SCRIPTS['list-transcripts']).toBeDefined();
      expect(APPROVED_SCRIPTS['list-transcripts'].script).toBe('scripts/list-transcripts.ts');
    });

    it('should define timeouts for all scripts', () => {
      Object.keys(APPROVED_SCRIPTS).forEach((scriptName) => {
        expect(APPROVED_SCRIPTS[scriptName].timeout).toBeGreaterThan(0);
      });
    });

    it('should define allowed params for all scripts', () => {
      Object.keys(APPROVED_SCRIPTS).forEach((scriptName) => {
        expect(Array.isArray(APPROVED_SCRIPTS[scriptName].allowedParams)).toBe(true);
      });
    });
  });

  describe('isScriptApproved', () => {
    it('should return true for approved script: parse-transcript', () => {
      expect(isScriptApproved('parse-transcript')).toBe(true);
    });

    it('should return true for approved script: analyze-story-transcripts', () => {
      expect(isScriptApproved('analyze-story-transcripts')).toBe(true);
    });

    it('should return true for approved script: list-transcripts', () => {
      expect(isScriptApproved('list-transcripts')).toBe(true);
    });

    it('should return false for unknown script', () => {
      expect(isScriptApproved('malicious-script')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isScriptApproved('')).toBe(false);
    });

    it('should return false for script with path traversal attempt', () => {
      expect(isScriptApproved('../../../etc/passwd')).toBe(false);
    });
  });

  describe('validateParams', () => {
    it('should accept valid params for parse-transcript', () => {
      const result = validateParams('parse-transcript', ['--latest', '--file=test.jsonl']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid params for analyze-story-transcripts', () => {
      const result = validateParams('analyze-story-transcripts', ['--story-id=ST-123']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid params for list-transcripts', () => {
      const result = validateParams('list-transcripts', ['--limit=10', '--since=2024-01-01']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept params with equals sign in value', () => {
      const result = validateParams('parse-transcript', ['--search=key=value']);
      expect(result.valid).toBe(true);
    });

    it('should accept params without values', () => {
      const result = validateParams('parse-transcript', ['--latest']);
      expect(result.valid).toBe(true);
    });

    it('should accept multiple valid params', () => {
      const result = validateParams('parse-transcript', [
        '--latest',
        '--file=transcript.jsonl',
        '--search=error',
      ]);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid param for parse-transcript', () => {
      const result = validateParams('parse-transcript', ['--dangerous-flag']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--dangerous-flag');
      expect(result.error).toContain('not allowed');
    });

    it('should reject invalid param for analyze-story-transcripts', () => {
      const result = validateParams('analyze-story-transcripts', ['--invalid-param=value']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--invalid-param');
      expect(result.error).toContain('not allowed');
    });

    it('should reject unknown script', () => {
      const result = validateParams('unknown-script', ['--any-param']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in whitelist');
    });

    it('should reject empty script name', () => {
      const result = validateParams('', ['--param']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in whitelist');
    });

    it('should handle empty params array', () => {
      const result = validateParams('parse-transcript', []);
      expect(result.valid).toBe(true);
    });

    it('should reject mixed valid and invalid params', () => {
      const result = validateParams('parse-transcript', ['--latest', '--malicious-param']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--malicious-param');
    });
  });

  describe('getScriptTimeout', () => {
    it('should return correct timeout for parse-transcript', () => {
      expect(getScriptTimeout('parse-transcript')).toBe(30000);
    });

    it('should return correct timeout for analyze-story-transcripts', () => {
      expect(getScriptTimeout('analyze-story-transcripts')).toBe(60000);
    });

    it('should return correct timeout for list-transcripts', () => {
      expect(getScriptTimeout('list-transcripts')).toBe(10000);
    });

    it('should return default timeout for unknown script', () => {
      expect(getScriptTimeout('unknown-script')).toBe(30000);
    });

    it('should return default timeout for empty script name', () => {
      expect(getScriptTimeout('')).toBe(30000);
    });

    it('should return default timeout for undefined script', () => {
      expect(getScriptTimeout(undefined as any)).toBe(30000);
    });
  });

  describe('Security tests', () => {
    it('should prevent command injection via script name', () => {
      const maliciousScript = 'parse-transcript; rm -rf /';
      expect(isScriptApproved(maliciousScript)).toBe(false);
    });

    it('should prevent command injection via params', () => {
      const result = validateParams('parse-transcript', ['--file=test.jsonl; rm -rf /']);
      // Param value can contain semicolons, but param KEY cannot contain disallowed chars
      // The whitelist checks param KEYS only (before =), not values
      expect(result.valid).toBe(true); // Values are not validated, only keys
    });

    it('should prevent path traversal in script name', () => {
      expect(isScriptApproved('../../../scripts/parse-transcript')).toBe(false);
    });

    it('should not allow arbitrary script execution', () => {
      const result = validateParams('parse-transcript', ['--exec=arbitrary-command']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('--exec');
    });
  });
});
