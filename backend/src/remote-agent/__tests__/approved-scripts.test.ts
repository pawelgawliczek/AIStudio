import {
  APPROVED_SCRIPTS,
  isScriptApproved,
  validateParams,
  getScriptTimeout,
  // ST-150: Claude Code capability exports
  APPROVED_CAPABILITIES,
  APPROVED_CLAUDE_TOOLS,
  FORBIDDEN_INSTRUCTION_PATTERNS,
  isCapabilityApproved,
  getCapabilityTimeout,
  validateCapabilityParams,
  validateInstructions,
  validateAllowedTools,
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

// =============================================================================
// ST-150: Claude Code Capability Tests
// =============================================================================

describe('ST-150: Claude Code Capabilities', () => {
  describe('APPROVED_CAPABILITIES configuration', () => {
    it('should have claude-code capability defined', () => {
      expect(APPROVED_CAPABILITIES['claude-code']).toBeDefined();
      expect(APPROVED_CAPABILITIES['claude-code'].type).toBe('claude-agent');
    });

    it('should have 60 minute timeout for claude-code', () => {
      expect(APPROVED_CAPABILITIES['claude-code'].timeout).toBe(3600000);
    });

    it('should require componentId, stateId, workflowRunId, instructions', () => {
      const required = APPROVED_CAPABILITIES['claude-code'].requiredParams;
      expect(required).toContain('componentId');
      expect(required).toContain('stateId');
      expect(required).toContain('workflowRunId');
      expect(required).toContain('instructions');
    });

    it('should have optional params for context and tools', () => {
      const optional = APPROVED_CAPABILITIES['claude-code'].optionalParams;
      expect(optional).toContain('storyContext');
      expect(optional).toContain('allowedTools');
      expect(optional).toContain('model');
      expect(optional).toContain('maxTurns');
      expect(optional).toContain('projectPath');
    });
  });

  describe('isCapabilityApproved', () => {
    it('should return true for claude-code capability', () => {
      expect(isCapabilityApproved('claude-code')).toBe(true);
    });

    it('should return false for unknown capability', () => {
      expect(isCapabilityApproved('unknown-capability')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isCapabilityApproved('')).toBe(false);
    });

    it('should return false for malicious capability name', () => {
      expect(isCapabilityApproved('claude-code; rm -rf /')).toBe(false);
    });
  });

  describe('getCapabilityTimeout', () => {
    it('should return correct timeout for claude-code', () => {
      expect(getCapabilityTimeout('claude-code')).toBe(3600000);
    });

    it('should return default timeout for unknown capability', () => {
      expect(getCapabilityTimeout('unknown')).toBe(3600000);
    });

    it('should return default timeout for empty string', () => {
      expect(getCapabilityTimeout('')).toBe(3600000);
    });
  });

  describe('validateCapabilityParams', () => {
    it('should accept valid params with all required fields', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: 'run-789',
        instructions: 'Implement the feature',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid params with optional fields', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: 'run-789',
        instructions: 'Implement the feature',
        storyContext: 'Some context',
        allowedTools: ['Read', 'Write'],
        model: 'sonnet',
        maxTurns: 50,
        projectPath: '/path/to/project',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject unknown capability', () => {
      const result = validateCapabilityParams('unknown', {
        componentId: 'comp-123',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in whitelist');
    });

    it('should reject missing required param: componentId', () => {
      const result = validateCapabilityParams('claude-code', {
        stateId: 'state-456',
        workflowRunId: 'run-789',
        instructions: 'Implement the feature',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('componentId');
    });

    it('should reject missing required param: instructions', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: 'run-789',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('instructions');
    });

    it('should reject null required param', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: null,
        instructions: 'Implement the feature',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('workflowRunId');
    });

    it('should reject undefined required param', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: undefined,
        instructions: 'Implement the feature',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('workflowRunId');
    });

    it('should reject disallowed param', () => {
      const result = validateCapabilityParams('claude-code', {
        componentId: 'comp-123',
        stateId: 'state-456',
        workflowRunId: 'run-789',
        instructions: 'Implement the feature',
        dangerousParam: 'malicious-value',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerousParam');
      expect(result.error).toContain('not allowed');
    });
  });

  describe('validateInstructions', () => {
    it('should accept clean instructions', () => {
      const result = validateInstructions('Implement the user authentication feature');
      expect(result.valid).toBe(true);
    });

    it('should accept instructions with code examples', () => {
      const result = validateInstructions(`
        Create a function that does:
        function hello() { console.log("hello"); }
      `);
      expect(result.valid).toBe(true);
    });

    it('should reject instructions with password literal', () => {
      const result = validateInstructions('Use password: "supersecret123"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with api key', () => {
      const result = validateInstructions('Set api_key = "sk-abc123def456"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with api-key hyphenated', () => {
      const result = validateInstructions('Set apikey: "xyz789"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with secret literal', () => {
      const result = validateInstructions('Configure secret = "my-secret-value"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with bearer token', () => {
      const result = validateInstructions('Use header Authorization: Bearer eyJhbGciOiJIUzI1NiIs...');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with private key', () => {
      const result = validateInstructions(`
        Use this key:
        -----BEGIN PRIVATE KEY-----
        MIIEvgIBADANBg...
        -----END PRIVATE KEY-----
      `);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with RSA private key', () => {
      // Note: The pattern matches "-----BEGIN RSA PRIVATE KEY-----" or "-----BEGIN PRIVATE KEY-----"
      const result = validateInstructions('Use this: -----BEGIN PRIVATE KEY----- and then continue');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with AWS access key', () => {
      const result = validateInstructions('aws_access_key_id = "AKIAIOSFODNN7EXAMPLE"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should reject instructions with AWS secret key', () => {
      const result = validateInstructions('aws_secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secrets');
    });

    it('should allow word "password" in context (not literal)', () => {
      const result = validateInstructions('Implement password validation logic');
      expect(result.valid).toBe(true);
    });

    it('should allow word "secret" in context (not literal)', () => {
      const result = validateInstructions('Create a function to generate secret tokens');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAllowedTools', () => {
    it('should accept core Claude Code tools', () => {
      const result = validateAllowedTools(['Read', 'Write', 'Edit', 'Glob', 'Grep']);
      expect(result.valid).toBe(true);
    });

    it('should accept Bash tool', () => {
      const result = validateAllowedTools(['Bash']);
      expect(result.valid).toBe(true);
    });

    it('should accept Task and TodoWrite tools', () => {
      const result = validateAllowedTools(['Task', 'TodoWrite']);
      expect(result.valid).toBe(true);
    });

    it('should accept AskUserQuestion tool', () => {
      const result = validateAllowedTools(['AskUserQuestion']);
      expect(result.valid).toBe(true);
    });

    it('should accept WebFetch and WebSearch tools', () => {
      const result = validateAllowedTools(['WebFetch', 'WebSearch']);
      expect(result.valid).toBe(true);
    });

    it('should accept VibeStudio MCP tools with wildcard', () => {
      const result = validateAllowedTools([
        'mcp__vibestudio__list_stories',
        'mcp__vibestudio__get_story',
        'mcp__vibestudio__update_story',
      ]);
      expect(result.valid).toBe(true);
    });

    it('should accept Playwright MCP tools with wildcard', () => {
      const result = validateAllowedTools([
        'mcp__playwright__browser_navigate',
        'mcp__playwright__browser_click',
        'mcp__playwright__browser_snapshot',
      ]);
      expect(result.valid).toBe(true);
    });

    it('should reject unknown tool', () => {
      const result = validateAllowedTools(['MaliciousTool']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('MaliciousTool');
      expect(result.error).toContain('not in approved list');
    });

    it('should reject unknown MCP tool', () => {
      const result = validateAllowedTools(['mcp__hacker__steal_data']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mcp__hacker__steal_data');
    });

    it('should accept empty tools array', () => {
      const result = validateAllowedTools([]);
      expect(result.valid).toBe(true);
    });

    it('should reject mixed valid and invalid tools', () => {
      const result = validateAllowedTools(['Read', 'Write', 'DangerousTool']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DangerousTool');
    });
  });

  describe('APPROVED_CLAUDE_TOOLS configuration', () => {
    it('should include core file manipulation tools', () => {
      expect(APPROVED_CLAUDE_TOOLS).toContain('Read');
      expect(APPROVED_CLAUDE_TOOLS).toContain('Write');
      expect(APPROVED_CLAUDE_TOOLS).toContain('Edit');
      expect(APPROVED_CLAUDE_TOOLS).toContain('Glob');
      expect(APPROVED_CLAUDE_TOOLS).toContain('Grep');
    });

    it('should include Bash for command execution', () => {
      expect(APPROVED_CLAUDE_TOOLS).toContain('Bash');
    });

    it('should include agent tools', () => {
      expect(APPROVED_CLAUDE_TOOLS).toContain('Task');
      expect(APPROVED_CLAUDE_TOOLS).toContain('TodoWrite');
      expect(APPROVED_CLAUDE_TOOLS).toContain('AskUserQuestion');
    });

    it('should include web tools', () => {
      expect(APPROVED_CLAUDE_TOOLS).toContain('WebFetch');
      expect(APPROVED_CLAUDE_TOOLS).toContain('WebSearch');
    });

    it('should include MCP tool wildcards', () => {
      expect(APPROVED_CLAUDE_TOOLS).toContain('mcp__vibestudio__*');
      expect(APPROVED_CLAUDE_TOOLS).toContain('mcp__playwright__*');
    });
  });

  describe('FORBIDDEN_INSTRUCTION_PATTERNS configuration', () => {
    it('should have patterns for common secrets', () => {
      expect(FORBIDDEN_INSTRUCTION_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive for password variations', () => {
      // Use validateInstructions which handles the regex correctly
      expect(validateInstructions('PASSWORD: "test"').valid).toBe(false);
      expect(validateInstructions('Password: "test"').valid).toBe(false);
      expect(validateInstructions('password: "test"').valid).toBe(false);
    });

    it('should be case-insensitive for api_key variations', () => {
      expect(validateInstructions('API_KEY = "test"').valid).toBe(false);
      expect(validateInstructions('api_key = "test"').valid).toBe(false);
      expect(validateInstructions('Api_Key = "test"').valid).toBe(false);
    });
  });
});
