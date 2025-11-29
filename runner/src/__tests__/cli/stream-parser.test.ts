/**
 * Tests for StreamParser
 */

import {
  StreamParser,
  parseMasterResponse,
  parseJSONL,
  TranscriptRecord,
} from '../../cli/stream-parser';
import { DEFAULT_MASTER_RESPONSE } from '../../types/master-response';

describe('StreamParser', () => {
  let parser: StreamParser;

  beforeEach(() => {
    parser = new StreamParser();
  });

  describe('parseLine', () => {
    it('should parse valid JSONL record', () => {
      const line = '{"type":"message","timestamp":"2025-01-01T00:00:00Z"}';
      const record = parser.parseLine(line);

      expect(record).not.toBeNull();
      expect(record?.type).toBe('message');
      expect(record?.timestamp).toBe('2025-01-01T00:00:00Z');
    });

    it('should return null for invalid JSON', () => {
      const line = 'not valid json';
      const record = parser.parseLine(line);

      expect(record).toBeNull();
    });

    it('should return null for empty line', () => {
      const record = parser.parseLine('');

      expect(record).toBeNull();
    });

    it('should return null for whitespace-only line', () => {
      const record = parser.parseLine('   \n  \t  ');

      expect(record).toBeNull();
    });

    it('should store parsed record', () => {
      const line = '{"type":"test"}';
      parser.parseLine(line);

      const records = parser.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('test');
    });
  });

  describe('parseBuffer', () => {
    it('should parse multiple complete lines', () => {
      parser.append('{"type":"line1"}\n{"type":"line2"}\n{"type":"line3"}\n');

      const records = parser.parseBuffer();

      expect(records).toHaveLength(3);
      expect(records[0].type).toBe('line1');
      expect(records[1].type).toBe('line2');
      expect(records[2].type).toBe('line3');
    });

    it('should keep incomplete line in buffer', () => {
      parser.append('{"type":"complete"}\n{"type":"incom');

      const records = parser.parseBuffer();

      expect(records).toHaveLength(1);
      expect(records[0].type).toBe('complete');
      expect(parser.getBuffer()).toBe('{"type":"incom');
    });

    it('should handle empty buffer', () => {
      const records = parser.parseBuffer();

      expect(records).toEqual([]);
    });

    it('should handle buffer with only newlines', () => {
      parser.append('\n\n\n');

      const records = parser.parseBuffer();

      expect(records).toEqual([]);
    });

    it('should parse incrementally as data arrives', () => {
      parser.append('{"type":"p');
      expect(parser.parseBuffer()).toEqual([]);

      parser.append('art1"}\n{"t');
      const records1 = parser.parseBuffer();
      expect(records1).toHaveLength(1);
      expect(records1[0].type).toBe('part1');

      parser.append('ype":"part2"}\n');
      const records2 = parser.parseBuffer();
      expect(records2).toHaveLength(1);
      expect(records2[0].type).toBe('part2');
    });
  });

  describe('hasCompleteResponse', () => {
    it('should return false for empty buffer', () => {
      expect(parser.hasCompleteResponse()).toBe(false);
    });

    it('should return true when MasterResponse block is present', () => {
      parser.append('```json:master-response\n{"action":"proceed","status":"success","message":"test"}\n```');

      expect(parser.hasCompleteResponse()).toBe(true);
    });

    it('should return false for incomplete MasterResponse block', () => {
      parser.append('```json:master-response\n{"action":"proceed"');

      expect(parser.hasCompleteResponse()).toBe(false);
    });

    it('should return false for other code blocks', () => {
      parser.append('```json\n{"some":"data"}\n```');

      expect(parser.hasCompleteResponse()).toBe(false);
    });
  });

  describe('extractMasterResponse', () => {
    it('should extract valid MasterResponse from buffer', () => {
      const responseJson = '{"action":"proceed","status":"success","message":"Proceeding"}';
      parser.append(`Some text\n\`\`\`json:master-response\n${responseJson}\n\`\`\`\nMore text`);

      const response = parser.extractMasterResponse();

      expect(response.action).toBe('proceed');
      expect(response.status).toBe('success');
      expect(response.message).toBe('Proceeding');
    });

    it('should return DEFAULT_MASTER_RESPONSE when no block found', () => {
      parser.append('Some text without MasterResponse');

      const response = parser.extractMasterResponse();

      expect(response).toEqual(DEFAULT_MASTER_RESPONSE);
    });

    it('should return DEFAULT_MASTER_RESPONSE for invalid JSON', () => {
      parser.append('```json:master-response\ninvalid json\n```');

      const response = parser.extractMasterResponse();

      expect(response).toEqual(DEFAULT_MASTER_RESPONSE);
    });

    it('should return DEFAULT_MASTER_RESPONSE for invalid MasterResponse structure', () => {
      const invalidResponse = '{"action":"invalid_action","status":"success","message":"test"}';
      parser.append(`\`\`\`json:master-response\n${invalidResponse}\n\`\`\``);

      const response = parser.extractMasterResponse();

      expect(response).toEqual(DEFAULT_MASTER_RESPONSE);
    });

    it('should extract response with all optional fields', () => {
      const fullResponse = {
        action: 'pause',
        status: 'warning',
        message: 'Pausing for approval',
        output: {
          stateOutput: { result: 'partial' },
          decision: 'Need approval',
        },
        control: {
          waitCondition: {
            type: 'approval',
            timeout: 300000,
          },
        },
        meta: {
          tokensUsed: 1500,
          durationMs: 5000,
        },
      };

      parser.append(`\`\`\`json:master-response\n${JSON.stringify(fullResponse)}\n\`\`\``);

      const response = parser.extractMasterResponse();

      expect(response.action).toBe('pause');
      expect(response.output?.decision).toBe('Need approval');
      expect(response.control?.waitCondition?.type).toBe('approval');
      expect(response.meta?.tokensUsed).toBe(1500);
    });
  });

  describe('extractTextContent', () => {
    it('should extract text from message content blocks', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'text', text: 'World' },
            ],
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const text = parser.extractTextContent();

      expect(text).toContain('Hello');
      expect(text).toContain('World');
    });

    it('should skip non-text content blocks', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            content: [
              { type: 'text', text: 'Text content' },
              { type: 'tool_use' },
            ],
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const text = parser.extractTextContent();

      expect(text).toBe('Text content');
    });

    it('should return empty string for no text content', () => {
      const text = parser.extractTextContent();

      expect(text).toBe('');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate token metrics from records', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            id: 'msg-1',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
        },
        {
          message: {
            id: 'msg-2',
            usage: {
              input_tokens: 200,
              output_tokens: 75,
            },
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const metrics = parser.calculateMetrics();

      expect(metrics.inputTokens).toBe(300);
      expect(metrics.outputTokens).toBe(125);
      expect(metrics.totalTokens).toBe(425);
    });

    it('should deduplicate messages by ID', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            id: 'msg-1',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
        },
        {
          message: {
            id: 'msg-1', // Duplicate ID
            usage: {
              input_tokens: 200,
              output_tokens: 75,
            },
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const metrics = parser.calculateMetrics();

      // Should use last occurrence
      expect(metrics.inputTokens).toBe(200);
      expect(metrics.outputTokens).toBe(75);
    });

    it('should include cache tokens', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            id: 'msg-1',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 20,
              cache_read_input_tokens: 30,
            },
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const metrics = parser.calculateMetrics();

      expect(metrics.cacheCreationTokens).toBe(20);
      expect(metrics.cacheReadTokens).toBe(30);
    });

    it('should extract model name', () => {
      const records: TranscriptRecord[] = [
        {
          message: {
            id: 'msg-1',
            model: 'claude-sonnet-4',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          },
        },
      ];

      records.forEach(r => parser.parseLine(JSON.stringify(r)));

      const metrics = parser.calculateMetrics();

      expect(metrics.model).toBe('claude-sonnet-4');
    });

    it('should return zero metrics for no records', () => {
      const metrics = parser.calculateMetrics();

      expect(metrics.inputTokens).toBe(0);
      expect(metrics.outputTokens).toBe(0);
      expect(metrics.totalTokens).toBe(0);
      expect(metrics.cacheCreationTokens).toBe(0);
      expect(metrics.cacheReadTokens).toBe(0);
    });
  });

  describe('getBuffer', () => {
    it('should return current buffer content', () => {
      parser.append('test content');

      expect(parser.getBuffer()).toBe('test content');
    });

    it('should return empty string initially', () => {
      expect(parser.getBuffer()).toBe('');
    });
  });

  describe('getRecords', () => {
    it('should return all parsed records', () => {
      parser.parseLine('{"type":"record1"}');
      parser.parseLine('{"type":"record2"}');

      const records = parser.getRecords();

      expect(records).toHaveLength(2);
      expect(records[0].type).toBe('record1');
      expect(records[1].type).toBe('record2');
    });

    it('should return copy of records array', () => {
      parser.parseLine('{"type":"test"}');

      const records1 = parser.getRecords();
      const records2 = parser.getRecords();

      expect(records1).toEqual(records2);
      expect(records1).not.toBe(records2); // Different array instances
    });
  });

  describe('clear', () => {
    it('should clear buffer and records', () => {
      parser.append('test buffer');
      parser.parseLine('{"type":"test"}');

      parser.clear();

      expect(parser.getBuffer()).toBe('');
      expect(parser.getRecords()).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large buffers', () => {
      const largeData = 'x'.repeat(1000000);
      parser.append(largeData);

      expect(parser.getBuffer().length).toBe(1000000);
    });

    it('should handle many newlines', () => {
      parser.append('\n'.repeat(1000));
      const records = parser.parseBuffer();

      expect(records).toEqual([]);
    });

    it('should handle mixed valid and invalid JSON lines', () => {
      parser.append('{"type":"valid1"}\ninvalid json\n{"type":"valid2"}\n');

      const records = parser.parseBuffer();

      expect(records).toHaveLength(2);
      expect(records[0].type).toBe('valid1');
      expect(records[1].type).toBe('valid2');
    });

    it('should handle unicode characters', () => {
      const unicodeLine = '{"text":"Hello 世界 🌍"}';
      parser.parseLine(unicodeLine);

      const records = parser.getRecords();
      expect((records[0] as any).text).toBe('Hello 世界 🌍');
    });
  });
});

describe('Utility Functions', () => {
  describe('parseMasterResponse', () => {
    it('should parse MasterResponse from text', () => {
      const text = '```json:master-response\n{"action":"stop","status":"success","message":"Done"}\n```';

      const response = parseMasterResponse(text);

      expect(response.action).toBe('stop');
      expect(response.status).toBe('success');
      expect(response.message).toBe('Done');
    });

    it('should return default for text without response', () => {
      const response = parseMasterResponse('No response here');

      expect(response).toEqual(DEFAULT_MASTER_RESPONSE);
    });
  });

  describe('parseJSONL', () => {
    it('should parse JSONL file content', () => {
      const content = '{"type":"line1"}\n{"type":"line2"}\n{"type":"line3"}';

      const records = parseJSONL(content);

      expect(records).toHaveLength(3);
      expect(records[0].type).toBe('line1');
      expect(records[1].type).toBe('line2');
      expect(records[2].type).toBe('line3');
    });

    it('should skip invalid lines', () => {
      const content = '{"type":"valid"}\ninvalid\n{"type":"valid2"}';

      const records = parseJSONL(content);

      expect(records).toHaveLength(2);
    });

    it('should handle empty content', () => {
      const records = parseJSONL('');

      expect(records).toEqual([]);
    });

    it('should handle trailing newline', () => {
      const content = '{"type":"test"}\n';

      const records = parseJSONL(content);

      expect(records).toHaveLength(1);
    });
  });
});
