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

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TranscriptParser,
  ParsedTranscript,
  ConversationTurn,
  ToolCall,
  ToolResult,
} from '../transcript-parser';

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

  /**
   * ST-251: Frontend Transcript Parser Token Fix (TDD)
   *
   * THESE TESTS WILL FAIL INITIALLY - This is proper TDD.
   *
   * Issue: Frontend over-counts input tokens by ~2x due to:
   * 1. Missing message ID deduplication (streaming updates counted multiple times)
   * 2. Incorrect cache token handling (cache_read should use MAX, not SUM)
   * 3. Missing cache token fields in metrics interface
   */
  describe('ST-251: Message ID Deduplication (TDD)', () => {
    it('should deduplicate streaming updates with same message ID (use LAST value)', () => {
      // Claude Code sends multiple lines with same message ID during streaming
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":100}}}
{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":200}}}
{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":300}}}`;

      const result = parser.parseJSONL(jsonl);

      // Should count msg_001 only once, using LAST value (output_tokens: 300)
      expect(result.metrics.inputTokens).toBe(1000);
      expect(result.metrics.outputTokens).toBe(300); // LAST value, not SUM
      expect(result.metrics.totalTokens).toBe(1300);
    });

    it('should sum tokens from different message IDs', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750}}}
{"type":"assistant","message":{"id":"msg_003","usage":{"input_tokens":1500,"output_tokens":600}}}`;

      const result = parser.parseJSONL(jsonl);

      // Different IDs should be summed
      expect(result.metrics.inputTokens).toBe(4500); // 1000 + 2000 + 1500
      expect(result.metrics.outputTokens).toBe(1850); // 500 + 750 + 600
      expect(result.metrics.totalTokens).toBe(6350);
    });

    it('should handle messages without ID gracefully (treat as unique)', () => {
      const jsonl = `{"type":"assistant","message":{"usage":{"input_tokens":1000,"output_tokens":500}}}
{"type":"assistant","message":{"usage":{"input_tokens":2000,"output_tokens":750}}}`;

      const result = parser.parseJSONL(jsonl);

      // Messages without ID should be treated as separate (summed)
      expect(result.metrics.inputTokens).toBe(3000);
      expect(result.metrics.outputTokens).toBe(1250);
      expect(result.metrics.totalTokens).toBe(4250);
    });

    it('should handle mixed messages with and without IDs', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500}}}
{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":600}}}
{"type":"assistant","message":{"usage":{"input_tokens":2000,"output_tokens":750}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":1500,"output_tokens":400}}}`;

      const result = parser.parseJSONL(jsonl);

      // msg_001: use LAST (input:1000, output:600)
      // no ID: count once (input:2000, output:750)
      // msg_002: count once (input:1500, output:400)
      expect(result.metrics.inputTokens).toBe(4500); // 1000 + 2000 + 1500
      expect(result.metrics.outputTokens).toBe(1750); // 600 + 750 + 400
      expect(result.metrics.totalTokens).toBe(6250);
    });
  });

  describe('ST-251: Cache Token Handling (TDD)', () => {
    it('should use MAX for cache_read_input_tokens (not SUM)', () => {
      // Cache reads represent reused tokens - should take MAX, not SUM
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750,"cache_read_input_tokens":75000}}}
{"type":"assistant","message":{"id":"msg_003","usage":{"input_tokens":1500,"output_tokens":600,"cache_read_input_tokens":60000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toHaveProperty('cacheReadTokens');
      expect(result.metrics.cacheReadTokens).toBe(75000); // MAX, not 185000
    });

    it('should use SUM for cache_creation_input_tokens', () => {
      // Cache creation represents tokens written to cache - should be summed
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_creation_input_tokens":10000}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750,"cache_creation_input_tokens":15000}}}
{"type":"assistant","message":{"id":"msg_003","usage":{"input_tokens":1500,"output_tokens":600,"cache_creation_input_tokens":12000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toHaveProperty('cacheCreationTokens');
      expect(result.metrics.cacheCreationTokens).toBe(37000); // SUM: 10000 + 15000 + 12000
    });

    it('should handle missing cache fields (default to 0)', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics.cacheReadTokens).toBe(0);
      expect(result.metrics.cacheCreationTokens).toBe(0);
    });

    it('should handle partial cache fields', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics.cacheReadTokens).toBe(50000);
      expect(result.metrics.cacheCreationTokens).toBe(0);
    });

    it('should deduplicate cache tokens when message ID repeats (use LAST for cache_read, SUM for cache_creation)', () => {
      // Same message ID streaming updates
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":100,"cache_read_input_tokens":50000,"cache_creation_input_tokens":5000}}}
{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":200,"cache_read_input_tokens":60000,"cache_creation_input_tokens":6000}}}
{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":300,"cache_read_input_tokens":70000,"cache_creation_input_tokens":7000}}}`;

      const result = parser.parseJSONL(jsonl);

      // For same message ID, use LAST values
      expect(result.metrics.inputTokens).toBe(1000);
      expect(result.metrics.outputTokens).toBe(300);
      expect(result.metrics.cacheReadTokens).toBe(70000); // LAST value
      expect(result.metrics.cacheCreationTokens).toBe(7000); // LAST value (from deduplicated message)
    });
  });

  describe('ST-251: Total Tokens Billing Model (TDD)', () => {
    it('should calculate totalTokens = inputTokens + outputTokens + cacheCreationTokens (NOT including cache_read)', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000,"cache_creation_input_tokens":10000}}}`;

      const result = parser.parseJSONL(jsonl);

      // Billing model: totalTokens = input + output + cache_creation
      // cache_read is NOT billed (it's already cached)
      expect(result.metrics.totalTokens).toBe(11500); // 1000 + 500 + 10000
      expect(result.metrics.totalTokens).not.toBe(61500); // Should NOT include cache_read
    });

    it('should calculate totalTokens correctly with multiple messages', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000,"cache_creation_input_tokens":10000}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750,"cache_read_input_tokens":60000,"cache_creation_input_tokens":15000}}}`;

      const result = parser.parseJSONL(jsonl);

      // totalTokens = (1000 + 2000) + (500 + 750) + (10000 + 15000)
      expect(result.metrics.totalTokens).toBe(29250); // 3000 + 1250 + 25000
    });

    it('should calculate totalTokens correctly without cache tokens', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500}}}`;

      const result = parser.parseJSONL(jsonl);

      // totalTokens = input + output (no cache)
      expect(result.metrics.totalTokens).toBe(1500);
    });
  });

  describe('ST-251: Metrics Interface (TDD)', () => {
    it('should include cacheCreationTokens in metrics', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_creation_input_tokens":10000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toHaveProperty('cacheCreationTokens');
      expect(typeof result.metrics.cacheCreationTokens).toBe('number');
    });

    it('should include cacheReadTokens in metrics', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toHaveProperty('cacheReadTokens');
      expect(typeof result.metrics.cacheReadTokens).toBe('number');
    });

    it('should have all required metrics fields', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":50000,"cache_creation_input_tokens":10000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics).toHaveProperty('inputTokens');
      expect(result.metrics).toHaveProperty('outputTokens');
      expect(result.metrics).toHaveProperty('totalTokens');
      expect(result.metrics).toHaveProperty('cacheReadTokens');
      expect(result.metrics).toHaveProperty('cacheCreationTokens');
    });
  });

  describe('ST-251: Real-World Scenarios (TDD)', () => {
    it('should handle realistic Claude Code transcript with streaming and cache', () => {
      // Simulates real Claude Code transcript with:
      // - Streaming updates (same message ID)
      // - Cache reads
      // - Cache creation
      const jsonl = `{"type":"assistant","message":{"id":"msg_01XYZ","usage":{"input_tokens":5000,"output_tokens":100,"cache_read_input_tokens":150000,"cache_creation_input_tokens":20000}}}
{"type":"assistant","message":{"id":"msg_01XYZ","usage":{"input_tokens":5000,"output_tokens":250,"cache_read_input_tokens":150000,"cache_creation_input_tokens":20000}}}
{"type":"assistant","message":{"id":"msg_01XYZ","usage":{"input_tokens":5000,"output_tokens":500,"cache_read_input_tokens":150000,"cache_creation_input_tokens":20000}}}
{"type":"assistant","message":{"id":"msg_02ABC","usage":{"input_tokens":3000,"output_tokens":300,"cache_read_input_tokens":150000,"cache_creation_input_tokens":10000}}}`;

      const result = parser.parseJSONL(jsonl);

      // msg_01XYZ: dedup to LAST (input:5000, output:500, cache_read:150000, cache_creation:20000)
      // msg_02ABC: count once (input:3000, output:300, cache_read:150000, cache_creation:10000)
      expect(result.metrics.inputTokens).toBe(8000); // 5000 + 3000
      expect(result.metrics.outputTokens).toBe(800); // 500 + 300
      expect(result.metrics.cacheReadTokens).toBe(150000); // MAX(150000, 150000)
      expect(result.metrics.cacheCreationTokens).toBe(30000); // 20000 + 10000
      expect(result.metrics.totalTokens).toBe(38800); // 8000 + 800 + 30000 (NOT including cache_read)
    });

    it('should handle transcript with no cache usage', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics.inputTokens).toBe(3000);
      expect(result.metrics.outputTokens).toBe(1250);
      expect(result.metrics.cacheReadTokens).toBe(0);
      expect(result.metrics.cacheCreationTokens).toBe(0);
      expect(result.metrics.totalTokens).toBe(4250); // 3000 + 1250
    });

    it('should handle transcript with only cache reads (no creation)', () => {
      const jsonl = `{"type":"assistant","message":{"id":"msg_001","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":100000}}}
{"type":"assistant","message":{"id":"msg_002","usage":{"input_tokens":2000,"output_tokens":750,"cache_read_input_tokens":120000}}}`;

      const result = parser.parseJSONL(jsonl);

      expect(result.metrics.inputTokens).toBe(3000);
      expect(result.metrics.outputTokens).toBe(1250);
      expect(result.metrics.cacheReadTokens).toBe(120000); // MAX
      expect(result.metrics.cacheCreationTokens).toBe(0);
      expect(result.metrics.totalTokens).toBe(4250); // 3000 + 1250 (cache_read NOT included)
    });
  });
});
