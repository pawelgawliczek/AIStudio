/**
 * ST-194 Transcript Metrics Fix E2E Tests
 *
 * Tests the transcript parsing fixes:
 * 1. cache_read_input_tokens uses MAX (not SUM) - cumulative per message
 * 2. totalTokens = input + output + cache_creation (billing model)
 *
 * These tests validate the TranscriptParserService correctly calculates metrics
 * from Claude Code transcript files.
 *
 * Bug Context:
 * - Agent reported: 63.4k tokens
 * - System captured: 18 inputTokens, 405 totalTokens (WRONG)
 * - Root cause: cache_read was being summed (436,552) instead of MAX (62,961)
 * - Root cause: totalTokens didn't include cache_creation tokens
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TranscriptParserService } from '../transcript-parser.service';

describe('ST-194 Transcript Metrics Fix', () => {
  let parserService: TranscriptParserService;
  let tempDir: string;

  beforeAll(async () => {
    parserService = new TranscriptParserService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'st194-test-'));
  });

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // ============================================================
  // Test Case 1: Cache Read MAX Calculation
  // ============================================================
  describe('cache_read_input_tokens MAX calculation', () => {
    it('should use MAX for cumulative cache_read values, not SUM', async () => {
      // Create a test transcript with multiple messages having cumulative cache_read
      // This simulates real Claude Code behavior where cache_read is cumulative per message
      const transcriptContent = [
        // First message - small cache read (warming up)
        JSON.stringify({
          agentId: 'test-agent-1',
          sessionId: 'test-session-1',
          message: {
            model: 'claude-sonnet-4-20250514',
            usage: {
              input_tokens: 10,
              output_tokens: 100,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 1000, // First read
            },
          },
        }),
        // Second message - more context cached
        JSON.stringify({
          message: {
            model: 'claude-sonnet-4-20250514',
            usage: {
              input_tokens: 5,
              output_tokens: 150,
              cache_creation_input_tokens: 200,
              cache_read_input_tokens: 30000, // Cumulative: same context re-read
            },
          },
        }),
        // Third message - full context cached (highest cache_read)
        JSON.stringify({
          message: {
            model: 'claude-sonnet-4-20250514',
            usage: {
              input_tokens: 3,
              output_tokens: 137,
              cache_creation_input_tokens: 509,
              cache_read_input_tokens: 62961, // MAX - full cached context
            },
          },
        }),
        // Fourth message - same cached context
        JSON.stringify({
          message: {
            model: 'claude-sonnet-4-20250514',
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 62961, // Same MAX
            },
          },
        }),
      ].join('\n');

      const transcriptPath = path.join(tempDir, 'agent-cache-test.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();

      // ST-194 FIX: cache_read should be MAX (62961), NOT SUM (1000 + 30000 + 62961 + 62961 = 156922)
      expect(result!.cacheReadTokens).toBe(62961);
      console.log(`  ✓ cacheReadTokens = ${result!.cacheReadTokens} (MAX, not SUM)`);

      // Input/output should be SUM
      expect(result!.inputTokens).toBe(10 + 5 + 3 + 0); // 18
      expect(result!.outputTokens).toBe(100 + 150 + 137 + 0); // 387
      console.log(`  ✓ inputTokens = ${result!.inputTokens} (SUM)`);
      console.log(`  ✓ outputTokens = ${result!.outputTokens} (SUM)`);
    });

    it('should handle single message transcript correctly', async () => {
      const transcriptContent = JSON.stringify({
        agentId: 'single-msg-agent',
        message: {
          model: 'claude-haiku-4-5-20251001',
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 5000,
          },
        },
      });

      const transcriptPath = path.join(tempDir, 'agent-single.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();
      expect(result!.cacheReadTokens).toBe(5000); // Single message, MAX = value
      expect(result!.inputTokens).toBe(100);
      expect(result!.outputTokens).toBe(200);
    });
  });

  // ============================================================
  // Test Case 2: Total Tokens Calculation (Billing Model)
  // ============================================================
  describe('totalTokens calculation (billing model)', () => {
    it('should calculate totalTokens = input + output + cache_creation', async () => {
      const transcriptContent = [
        JSON.stringify({
          agentId: 'billing-test-agent',
          message: {
            model: 'claude-sonnet-4-20250514',
            usage: {
              input_tokens: 18,
              output_tokens: 387,
              cache_creation_input_tokens: 1209,
              cache_read_input_tokens: 62961,
            },
          },
        }),
      ].join('\n');

      const transcriptPath = path.join(tempDir, 'agent-billing.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();

      // ST-194 FIX: totalTokens = input + output + cache_creation
      // NOT just input + output (which was 405)
      const expectedTotal = 18 + 387 + 1209; // 1614
      expect(result!.totalTokens).toBe(expectedTotal);
      console.log(`  ✓ totalTokens = ${result!.totalTokens} (input + output + cache_creation)`);

      // Verify cache_read is NOT included in totalTokens (it's already counted in input)
      // cache_read represents reused context, not new billable tokens
      expect(result!.totalTokens).toBeLessThan(result!.cacheReadTokens);
      console.log(`  ✓ totalTokens (${result!.totalTokens}) < cacheReadTokens (${result!.cacheReadTokens})`);
    });

    it('should handle multiple messages in totalTokens sum', async () => {
      const transcriptContent = [
        JSON.stringify({
          message: {
            usage: {
              input_tokens: 10,
              output_tokens: 100,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 1000,
            },
          },
        }),
        JSON.stringify({
          message: {
            usage: {
              input_tokens: 5,
              output_tokens: 50,
              cache_creation_input_tokens: 200,
              cache_read_input_tokens: 1500,
            },
          },
        }),
      ].join('\n');

      const transcriptPath = path.join(tempDir, 'agent-multi-billing.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();

      // totalTokens = sum(input) + sum(output) + sum(cache_creation)
      // = (10 + 5) + (100 + 50) + (500 + 200) = 15 + 150 + 700 = 865
      expect(result!.totalTokens).toBe(865);

      // cache_read = MAX(1000, 1500) = 1500
      expect(result!.cacheReadTokens).toBe(1500);
    });
  });

  // ============================================================
  // Test Case 3: Real-World Scenario (ST-193 Bug)
  // ============================================================
  describe('real-world scenario validation', () => {
    it('should correctly parse transcript similar to ST-193 bug scenario', async () => {
      // This simulates the exact scenario from ST-193 where:
      // - Agent displayed: 63.4k tokens
      // - System showed: 18 input, 405 total (WRONG)
      //
      // The agent has multiple messages with cumulative cache_read
      const transcriptContent = [
        // Message 1: Initial context
        JSON.stringify({
          agentId: 'd136748e',
          sessionId: 'test-session',
          message: {
            model: 'claude-haiku-4-5-20251001',
            usage: {
              input_tokens: 6,
              output_tokens: 120,
              cache_creation_input_tokens: 400,
              cache_read_input_tokens: 61942,
            },
          },
        }),
        // Message 2: Same cached context
        JSON.stringify({
          message: {
            model: 'claude-haiku-4-5-20251001',
            usage: {
              input_tokens: 4,
              output_tokens: 130,
              cache_creation_input_tokens: 300,
              cache_read_input_tokens: 62500,
            },
          },
        }),
        // Message 3: Full context (what Claude Code displays as ~63k)
        JSON.stringify({
          message: {
            model: 'claude-haiku-4-5-20251001',
            usage: {
              input_tokens: 8,
              output_tokens: 137,
              cache_creation_input_tokens: 509,
              cache_read_input_tokens: 62961, // This is what Claude Code shows
            },
          },
        }),
      ].join('\n');

      const transcriptPath = path.join(tempDir, 'agent-st193-scenario.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();

      // BEFORE FIX (WRONG):
      // - cacheReadTokens: 61942 + 62500 + 62961 = 187403 (SUM)
      // - totalTokens: 18 + 387 = 405 (missing cache_creation)

      // AFTER FIX (CORRECT):
      // - cacheReadTokens: MAX(61942, 62500, 62961) = 62961
      // - totalTokens: 18 + 387 + 1209 = 1614

      // Verify cache_read is MAX
      expect(result!.cacheReadTokens).toBe(62961);
      console.log(`  ✓ cacheReadTokens = ${result!.cacheReadTokens} (matches Claude Code ~63k display)`);

      // Verify totalTokens includes cache_creation
      const expectedInput = 6 + 4 + 8; // 18
      const expectedOutput = 120 + 130 + 137; // 387
      const expectedCacheCreation = 400 + 300 + 509; // 1209
      const expectedTotal = expectedInput + expectedOutput + expectedCacheCreation; // 1614

      expect(result!.inputTokens).toBe(expectedInput);
      expect(result!.outputTokens).toBe(expectedOutput);
      expect(result!.cacheCreationTokens).toBe(expectedCacheCreation);
      expect(result!.totalTokens).toBe(expectedTotal);

      console.log(`  ✓ totalTokens = ${result!.totalTokens} (was 405, now correct: ${expectedTotal})`);
    });
  });

  // ============================================================
  // Test Case 4: Edge Cases
  // ============================================================
  describe('edge cases', () => {
    it('should handle missing cache fields gracefully', async () => {
      const transcriptContent = JSON.stringify({
        agentId: 'no-cache-agent',
        message: {
          model: 'claude-sonnet-4-20250514',
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            // No cache fields
          },
        },
      });

      const transcriptPath = path.join(tempDir, 'agent-no-cache.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();
      expect(result!.cacheReadTokens).toBe(0);
      expect(result!.cacheCreationTokens).toBe(0);
      expect(result!.totalTokens).toBe(300); // 100 + 200 + 0
    });

    it('should handle zero cache_read tokens', async () => {
      const transcriptContent = JSON.stringify({
        message: {
          usage: {
            input_tokens: 50,
            output_tokens: 100,
            cache_creation_input_tokens: 25,
            cache_read_input_tokens: 0,
          },
        },
      });

      const transcriptPath = path.join(tempDir, 'agent-zero-cache.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();
      expect(result!.cacheReadTokens).toBe(0);
      expect(result!.totalTokens).toBe(175); // 50 + 100 + 25
    });

    it('should extract agent ID from filename when not in content', async () => {
      const transcriptContent = JSON.stringify({
        // No agentId field
        message: {
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        },
      });

      // Filename follows pattern: agent-{id}.jsonl
      const transcriptPath = path.join(tempDir, 'agent-extracted123.jsonl');
      await fs.writeFile(transcriptPath, transcriptContent);

      const result = await parserService.parseAgentTranscript(transcriptPath);

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('extracted123');
    });
  });
});
