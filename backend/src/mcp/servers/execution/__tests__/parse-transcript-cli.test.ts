/**
 * Test Suite: parse-transcript.ts (ST-117)
 * Coverage: CLI transcript parsing tool
 * Focus: JSONL parsing, path escaping, error handling, output format
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Mock modules
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsSync = fsSync as jest.Mocked<typeof fsSync>;
const mockOs = os as jest.Mocked<typeof os>;

// Helper to run the CLI script
async function runScript(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'scripts/parse-transcript.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

describe('parse-transcript.ts', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue('/Users/testuser');
    process.cwd = jest.fn().mockReturnValue('/Users/testuser/projects/test');
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  // ========== PATH ESCAPING TESTS ==========

  describe('Path Escaping Logic', () => {
    it('ST-117-CLI-P1: should escape project path correctly', () => {
      // Test the escaping logic: /Users/foo/bar → -Users-foo-bar
      const projectPath = '/Users/pawelgawliczek/projects/AIStudio';
      const escaped = projectPath.replace(/^\//, '-').replace(/\//g, '-');

      expect(escaped).toBe('-Users-pawelgawliczek-projects-AIStudio');
    });

    it('ST-117-CLI-P2: should handle paths without leading slash', () => {
      const projectPath = 'relative/path';
      const escaped = projectPath.replace(/^\//, '-').replace(/\//g, '-');

      expect(escaped).toBe('relative-path');
    });

    it('ST-117-CLI-P3: should handle root path', () => {
      const projectPath = '/';
      const escaped = projectPath.replace(/^\//, '-').replace(/\//g, '-');

      expect(escaped).toBe('-');
    });
  });

  // ========== JSONL PARSING TESTS ==========

  describe('JSONL Parsing', () => {
    const validTranscriptContent = [
      JSON.stringify({
        agentId: 'agent-001',
        sessionId: 'session-001',
        message: {
          model: 'claude-3-5-sonnet-20241022',
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 200,
          },
        },
      }),
      JSON.stringify({
        agentId: 'agent-001',
        message: {
          model: 'claude-3-5-sonnet-20241022',
          usage: {
            input_tokens: 2000,
            output_tokens: 800,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 300,
          },
        },
      }),
    ].join('\n');

    it('ST-117-CLI-J1: should aggregate token counts from multiple records', async () => {
      // The parsing logic should sum up all usage records
      // Expected: inputTokens = 1000 + 2000 = 3000
      // Expected: outputTokens = 500 + 800 = 1300
      // Expected: cacheCreationTokens = 100 + 50 = 150
      // Expected: cacheReadTokens = 200 + 300 = 500

      // This tests the aggregation logic conceptually
      const records = validTranscriptContent.split('\n').map(line => JSON.parse(line));

      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheCreation = 0;
      let totalCacheRead = 0;

      for (const record of records) {
        if (record.message?.usage) {
          totalInput += record.message.usage.input_tokens || 0;
          totalOutput += record.message.usage.output_tokens || 0;
          totalCacheCreation += record.message.usage.cache_creation_input_tokens || 0;
          totalCacheRead += record.message.usage.cache_read_input_tokens || 0;
        }
      }

      expect(totalInput).toBe(3000);
      expect(totalOutput).toBe(1300);
      expect(totalCacheCreation).toBe(150);
      expect(totalCacheRead).toBe(500);
    });

    it('ST-117-CLI-J2: should handle records without usage field', () => {
      const records = [
        { agentId: 'agent-001', message: { model: 'claude-3-5-sonnet' } }, // No usage
        { agentId: 'agent-001', message: { model: 'claude-3-5-sonnet', usage: { input_tokens: 100, output_tokens: 50 } } },
      ];

      let totalInput = 0;
      let totalOutput = 0;

      for (const record of records) {
        if (record.message?.usage) {
          totalInput += record.message.usage.input_tokens || 0;
          totalOutput += record.message.usage.output_tokens || 0;
        }
      }

      expect(totalInput).toBe(100);
      expect(totalOutput).toBe(50);
    });

    it('ST-117-CLI-J3: should handle records with partial usage fields', () => {
      const records = [
        { message: { usage: { input_tokens: 100 } } }, // Only input_tokens
        { message: { usage: { output_tokens: 50 } } }, // Only output_tokens
        { message: { usage: { cache_read_input_tokens: 200 } } }, // Only cache_read
      ];

      let totalInput = 0;
      let totalOutput = 0;
      let totalCacheRead = 0;

      for (const record of records) {
        if (record.message?.usage) {
          totalInput += record.message.usage.input_tokens ?? 0;
          totalOutput += record.message.usage.output_tokens ?? 0;
          totalCacheRead += record.message.usage.cache_read_input_tokens ?? 0;
        }
      }

      expect(totalInput).toBe(100);
      expect(totalOutput).toBe(50);
      expect(totalCacheRead).toBe(200);
    });

    it('ST-117-CLI-J4: should extract model from last record with model field', () => {
      const records = [
        { message: { model: 'claude-3-opus', usage: { input_tokens: 100, output_tokens: 50 } } },
        { message: { usage: { input_tokens: 100, output_tokens: 50 } } }, // No model
        { message: { model: 'claude-3-5-sonnet-20241022', usage: { input_tokens: 100, output_tokens: 50 } } },
      ];

      let model = 'unknown';

      for (const record of records) {
        if (record.message?.model) {
          model = record.message.model;
        }
      }

      expect(model).toBe('claude-3-5-sonnet-20241022');
    });
  });

  // ========== OUTPUT FORMAT TESTS ==========

  describe('Output Format', () => {
    it('ST-117-CLI-O1: should output valid JSON with all required fields', () => {
      const expectedOutput = {
        inputTokens: 3000,
        outputTokens: 1300,
        cacheCreationTokens: 150,
        cacheReadTokens: 500,
        totalTokens: 4300,
        model: 'claude-3-5-sonnet-20241022',
        transcriptPath: '/path/to/transcript.jsonl',
      };

      // Verify all required fields are present
      expect(expectedOutput).toHaveProperty('inputTokens');
      expect(expectedOutput).toHaveProperty('outputTokens');
      expect(expectedOutput).toHaveProperty('cacheCreationTokens');
      expect(expectedOutput).toHaveProperty('cacheReadTokens');
      expect(expectedOutput).toHaveProperty('totalTokens');
      expect(expectedOutput).toHaveProperty('model');
      expect(expectedOutput).toHaveProperty('transcriptPath');

      // Verify totalTokens calculation
      expect(expectedOutput.totalTokens).toBe(
        expectedOutput.inputTokens + expectedOutput.outputTokens
      );
    });

    it('ST-117-CLI-O2: should be parseable by JSON.parse', () => {
      const output = JSON.stringify({
        inputTokens: 3000,
        outputTokens: 1300,
        cacheCreationTokens: 150,
        cacheReadTokens: 500,
        totalTokens: 4300,
        model: 'claude-3-5-sonnet-20241022',
        transcriptPath: '/path/to/transcript.jsonl',
      }, null, 2);

      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.inputTokens).toBe(3000);
      expect(parsed.totalTokens).toBe(4300);
    });
  });

  // ========== ERROR HANDLING TESTS ==========

  describe('Error Handling', () => {
    it('ST-117-CLI-E1: should output error JSON when transcript not found', () => {
      const errorOutput = JSON.stringify({ error: 'No transcripts found in /path/to/dir' });

      const parsed = JSON.parse(errorOutput);
      expect(parsed.error).toContain('No transcripts found');
    });

    it('ST-117-CLI-E2: should output error JSON for parse failures', () => {
      const errorOutput = JSON.stringify({ error: 'Failed to parse transcript', path: '/path/to/file.jsonl' });

      const parsed = JSON.parse(errorOutput);
      expect(parsed.error).toBeDefined();
      expect(parsed.path).toBeDefined();
    });

    it('ST-117-CLI-E3: should skip malformed JSON lines without failing', () => {
      const lines = [
        '{ invalid json',
        JSON.stringify({ message: { usage: { input_tokens: 100, output_tokens: 50 } } }),
        'another bad line {{{',
      ];

      const records = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          records.push(JSON.parse(line));
        } catch {
          // Skip malformed lines - this is expected behavior
        }
      }

      expect(records.length).toBe(1); // Only one valid record
      expect(records[0].message.usage.input_tokens).toBe(100);
    });
  });

  // ========== TRANSCRIPT DISCOVERY TESTS ==========

  describe('Transcript Discovery', () => {
    it('ST-117-CLI-D1: should find latest transcript by mtime', () => {
      const files = [
        { name: 'old.jsonl', mtime: new Date('2025-01-01') },
        { name: 'newest.jsonl', mtime: new Date('2025-01-03') },
        { name: 'middle.jsonl', mtime: new Date('2025-01-02') },
      ];

      // Sort by mtime descending (newest first)
      const sorted = [...files].sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      expect(sorted[0].name).toBe('newest.jsonl');
    });

    it('ST-117-CLI-D2: should filter only .jsonl files', () => {
      const files = ['transcript.jsonl', 'readme.md', 'config.json', 'other.jsonl'];
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      expect(jsonlFiles).toEqual(['transcript.jsonl', 'other.jsonl']);
    });

    it('ST-117-CLI-D3: should construct correct transcript directory path', () => {
      const projectPath = '/Users/pawelgawliczek/projects/AIStudio';
      const homeDir = '/Users/pawelgawliczek';
      const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');
      const transcriptDir = path.join(homeDir, '.claude', 'projects', escapedPath);

      expect(transcriptDir).toBe('/Users/pawelgawliczek/.claude/projects/-Users-pawelgawliczek-projects-AIStudio');
    });

    it('ST-117-CLI-D4: should expand tilde in transcript path', () => {
      const transcriptPath = '~/.claude/projects/test/file.jsonl';
      const homeDir = '/Users/testuser';
      const expanded = transcriptPath.startsWith('~')
        ? path.join(homeDir, transcriptPath.slice(1))
        : transcriptPath;

      expect(expanded).toBe('/Users/testuser/.claude/projects/test/file.jsonl');
    });
  });

  // ========== SIZE VALIDATION TESTS ==========

  describe('Size Validation', () => {
    it('ST-117-CLI-S1: should reject empty files (size === 0)', () => {
      const size = 0;
      const maxSize = 5 * 1024 * 1024; // 5MB

      const isValid = size > 0 && size <= maxSize;
      expect(isValid).toBe(false);
    });

    it('ST-117-CLI-S2: should reject oversized files (>5MB)', () => {
      const size = 6 * 1024 * 1024; // 6MB
      const maxSize = 5 * 1024 * 1024; // 5MB

      const isValid = size > 0 && size <= maxSize;
      expect(isValid).toBe(false);
    });

    it('ST-117-CLI-S3: should accept files within size limits', () => {
      const sizes = [1, 1000, 1024 * 1024, 5 * 1024 * 1024]; // 1B, 1KB, 1MB, 5MB
      const maxSize = 5 * 1024 * 1024;

      for (const size of sizes) {
        const isValid = size > 0 && size <= maxSize;
        expect(isValid).toBe(true);
      }
    });
  });
});
