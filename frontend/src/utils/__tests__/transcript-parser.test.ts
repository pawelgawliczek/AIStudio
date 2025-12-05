/**
 * Unit Tests for TranscriptParser (ST-173 Phase 5)
 *
 * TDD Implementation - These tests WILL FAIL until parser is implemented
 *
 * Security Requirements from SECURITY_REVIEW:
 * - Test Case 5: XSS prevention (DOMPurify sanitization)
 * - JSONL injection protection (schema validation)
 * - Prototype pollution protection
 */

import { describe, it, expect } from 'vitest';

// Parser under test (will fail until implemented)
class TranscriptParser {
  parseJSONL(rawTranscript: string): ParsedTranscript {
    throw new Error('Not implemented');
  }

  detectType(records: any[]): 'master' | 'agent' {
    throw new Error('Not implemented');
  }
}

interface ParsedTranscript {
  metadata: {
    sessionId: string;
    model: string;
    transcriptType: 'master' | 'agent';
  };
  turns: ConversationTurn[];
  metrics: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

interface ConversationTurn {
  type: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  usage?: { inputTokens: number; outputTokens: number };
}

interface ToolCall {
  name: string;
  input: any;
}

interface ToolResult {
  name: string;
  output: any;
}

describe('TranscriptParser - JSONL Parsing (TDD)', () => {
  let parser: TranscriptParser;

  beforeEach(() => {
    parser = new TranscriptParser();
  });

  describe('Valid JSONL Parsing', () => {
    it('should parse simple JSONL into conversation turns', () => {
      const jsonl = `{"type":"text","content":"Hello"}
{"type":"text","content":"World"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].content).toBe('Hello');
      expect(result.turns[1].content).toBe('World');
    });

    it('should group tool_use/tool_result with parent message', () => {
      const jsonl = `{"type":"text","role":"assistant","content":"Let me check that"}
{"type":"tool_use","name":"list_stories","input":{"projectId":"123"}}
{"type":"tool_result","name":"list_stories","output":{"stories":[]}}
{"type":"text","role":"assistant","content":"No stories found"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].toolCalls).toHaveLength(1);
      expect(result.turns[0].toolResults).toHaveLength(1);
      expect(result.turns[0].toolCalls![0].name).toBe('list_stories');
      expect(result.turns[1].content).toBe('No stories found');
    });

    it('should extract token metrics from usage fields', () => {
      const jsonl = `{"type":"text","content":"test","usage":{"inputTokens":100,"outputTokens":50}}
{"type":"text","content":"test2","usage":{"inputTokens":200,"outputTokens":75}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toEqual({
        inputTokens: 300,
        outputTokens: 125,
        totalTokens: 425,
      });
    });

    it('should handle empty lines gracefully', () => {
      const jsonl = `{"type":"text","content":"test"}

{"type":"text","content":"test2"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(2);
    });
  });

  describe('Test Case 5: XSS Prevention (CRITICAL)', () => {
    it('should sanitize script tags in content', () => {
      const jsonl = `{"type":"text","content":"<script>alert('XSS')</script>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).not.toContain('<script>');
      expect(result.turns[0].content).not.toContain('alert');
      // DOMPurify should strip tags completely
      expect(result.turns[0].content).toBe('');
    });

    it('should sanitize img tags with onerror', () => {
      const jsonl = `{"type":"text","content":"<img src=x onerror=alert(1)>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).not.toContain('onerror');
      expect(result.turns[0].content).not.toContain('alert');
    });

    it('should sanitize iframe tags', () => {
      const jsonl = `{"type":"text","content":"<iframe src=\\"evil.com\\"></iframe>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).not.toContain('<iframe>');
      expect(result.turns[0].content).not.toContain('evil.com');
    });

    it('should escape HTML entities', () => {
      const jsonl = `{"type":"text","content":"<div>Test & \\"quotes\\"</div>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).toContain('&lt;');
      expect(result.turns[0].content).toContain('&gt;');
      expect(result.turns[0].content).toContain('&quot;');
    });

    it('should sanitize JavaScript URLs', () => {
      const jsonl = `{"type":"text","content":"<a href=\\"javascript:alert(1)\\">Click</a>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).not.toContain('javascript:');
    });

    it('should sanitize data URLs', () => {
      const jsonl = `{"type":"text","content":"<a href=\\"data:text/html,<script>alert(1)</script>\\">Click</a>"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).not.toContain('data:');
    });
  });

  describe('JSONL Injection Protection (HIGH)', () => {
    it('should reject records with __proto__ field', () => {
      const jsonl = `{"__proto__":{"isAdmin":true}}`;

      expect(() => parser.parseJSONL(jsonl)).toThrow(/Invalid record schema/i);
    });

    it('should reject records with constructor field', () => {
      const jsonl = `{"constructor":{"prototype":{"polluted":true}}}`;

      expect(() => parser.parseJSONL(jsonl)).toThrow(/Invalid record schema/i);
    });

    it('should validate type field is enum', () => {
      const jsonl = `{"type":"malicious","content":"test"}`;

      expect(() => parser.parseJSONL(jsonl)).toThrow(/Invalid record type/i);
    });

    it('should reject records exceeding content length limit', () => {
      const jsonl = `{"type":"text","content":"${'x'.repeat(20000)}"}`;

      expect(() => parser.parseJSONL(jsonl)).toThrow(/Content too large/i);
    });

    it('should reject transcripts with too many lines', () => {
      const lines = Array(15000)
        .fill('{"type":"text","content":"test"}')
        .join('\n');

      expect(() => parser.parseJSONL(lines)).toThrow(/Transcript too large.*10,000 lines/i);
    });

    it('should accept valid types: text, tool_use, tool_result, system', () => {
      const jsonl = `{"type":"text","content":"test"}
{"type":"tool_use","name":"test","input":{}}
{"type":"tool_result","name":"test","output":{}}
{"type":"system","content":"system message"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(4);
    });
  });

  describe('Malformed JSON Handling', () => {
    it('should skip malformed JSON lines', () => {
      const jsonl = `{"type":"text","content":"valid"}
{malformed json}
{"type":"text","content":"also valid"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].content).toBe('valid');
      expect(result.turns[1].content).toBe('also valid');
    });

    it('should handle incomplete JSON lines', () => {
      const jsonl = `{"type":"text","content":"test"
{"type":"text","content":"complete"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns).toHaveLength(1);
      expect(result.turns[0].content).toBe('complete');
    });

    it('should handle trailing comma', () => {
      const jsonl = `{"type":"text","content":"test",}`;

      const result = parser.parseJSONL(jsonl);

      // Should skip invalid JSON
      expect(result.turns).toHaveLength(0);
    });
  });

  describe('Transcript Type Detection', () => {
    it('should detect master transcript by MCP tool presence', () => {
      const jsonl = `{"type":"text","content":"Starting workflow"}
{"type":"tool_use","name":"mcp__vibestudio__list_stories","input":{}}
{"type":"tool_result","name":"mcp__vibestudio__list_stories","output":{}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.transcriptType).toBe('master');
    });

    it('should detect agent transcript by task-specific tools', () => {
      const jsonl = `{"type":"text","content":"Implementing feature"}
{"type":"tool_use","name":"read","input":{"path":"file.ts"}}
{"type":"tool_result","name":"read","output":{"content":"code"}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.transcriptType).toBe('agent');
    });

    it('should default to agent for ambiguous transcripts', () => {
      const jsonl = `{"type":"text","content":"Hello world"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.transcriptType).toBe('agent');
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract session ID from SessionStart event', () => {
      const jsonl = `{"type":"system","event":"SessionStart","sessionId":"abc-123"}
{"type":"text","content":"test"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.sessionId).toBe('abc-123');
    });

    it('should extract model from first assistant message', () => {
      const jsonl = `{"type":"text","role":"assistant","content":"test","model":"claude-sonnet-4"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.model).toBe('claude-sonnet-4');
    });

    it('should handle missing metadata gracefully', () => {
      const jsonl = `{"type":"text","content":"test"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metadata.sessionId).toBe('unknown');
      expect(result.metadata.model).toBe('unknown');
    });
  });

  describe('Edge Cases', () => {
    it('should handle completely empty transcript', () => {
      const result = parser.parseJSONL('');

      expect(result.turns).toHaveLength(0);
      expect(result.metrics.totalTokens).toBe(0);
    });

    it('should handle transcript with only whitespace', () => {
      const result = parser.parseJSONL('   \n  \n  ');

      expect(result.turns).toHaveLength(0);
    });

    it('should handle transcript with single newline', () => {
      const result = parser.parseJSONL('\n');

      expect(result.turns).toHaveLength(0);
    });

    it('should handle Unicode characters', () => {
      const jsonl = `{"type":"text","content":"Hello 👋 世界 🌍"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).toContain('👋');
      expect(result.turns[0].content).toContain('世界');
      expect(result.turns[0].content).toContain('🌍');
    });

    it('should handle very long content (within limit)', () => {
      const longContent = 'x'.repeat(9000);
      const jsonl = `{"type":"text","content":"${longContent}"}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.turns[0].content).toHaveLength(9000);
    });
  });
});
