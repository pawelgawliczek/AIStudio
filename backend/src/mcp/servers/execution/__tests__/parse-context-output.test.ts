/**
 * ST-110: Unit tests for /context output parsing
 */

import { parseContextOutput, parseTokenValue } from '../parse-context-output';

describe('parseTokenValue', () => {
  it('should convert "k" suffix correctly', () => {
    expect(parseTokenValue('4.6k')).toBe(4600);
    expect(parseTokenValue('171k')).toBe(171000);
    expect(parseTokenValue('1.2k')).toBe(1200);
    expect(parseTokenValue('94.6k')).toBe(94600);
  });

  it('should handle whole numbers without suffix', () => {
    expect(parseTokenValue('4600')).toBe(4600);
    expect(parseTokenValue('171000')).toBe(171000);
  });

  it('should handle invalid values', () => {
    expect(parseTokenValue('invalid')).toBeNull();
    expect(parseTokenValue('')).toBeNull();
    expect(parseTokenValue('   ')).toBeNull();
  });

  it('should handle edge cases', () => {
    expect(parseTokenValue('0')).toBe(0);
    expect(parseTokenValue('0.0k')).toBe(0);
    expect(parseTokenValue('0.5k')).toBe(500);
  });
});

describe('parseContextOutput', () => {
  const STANDARD_CONTEXT_OUTPUT = `Context Usage
claude-opus-4-5-20251101 · 171k/200k tokens (85%)

System prompt: 4.6k tokens (2.3%)
System tools: 15.0k tokens (7.5%)
MCP tools: 94.6k tokens (47.3%)
Memory files: 5.4k tokens (2.7%)
Messages: 6.2k tokens (3.1%)
Free space: 29k (14.6%)
Autocompact buffer: 45.0k tokens (22.5%)`;

  it('should parse standard /context output', () => {
    const result = parseContextOutput(STANDARD_CONTEXT_OUTPUT);

    expect(result.tokensInput).toBe(171000);
    expect(result.tokensSystemPrompt).toBe(4600);
    expect(result.tokensSystemTools).toBe(15000);
    expect(result.tokensMcpTools).toBe(94600);
    expect(result.tokensMemoryFiles).toBe(5400);
    expect(result.tokensMessages).toBe(6200);
  });

  it('should handle partial /context output (missing some sections)', () => {
    const partialOutput = `Context Usage
claude-opus-4-5-20251101 · 171k/200k tokens (85%)

System prompt: 4.6k tokens (2.3%)
MCP tools: 94.6k tokens (47.3%)`;

    const result = parseContextOutput(partialOutput);

    expect(result.tokensInput).toBe(171000);
    expect(result.tokensSystemPrompt).toBe(4600);
    expect(result.tokensSystemTools).toBeNull();
    expect(result.tokensMcpTools).toBe(94600);
    expect(result.tokensMemoryFiles).toBeNull();
    expect(result.tokensMessages).toBeNull();
  });

  it('should handle malformed output', () => {
    const malformedOutput = 'INVALID OUTPUT';

    const result = parseContextOutput(malformedOutput);

    expect(result.tokensInput).toBeNull();
    expect(result.tokensSystemPrompt).toBeNull();
    expect(result.tokensSystemTools).toBeNull();
    expect(result.tokensMcpTools).toBeNull();
    expect(result.tokensMemoryFiles).toBeNull();
    expect(result.tokensMessages).toBeNull();
  });

  it('should handle empty string', () => {
    const result = parseContextOutput('');

    expect(result.tokensInput).toBeNull();
    expect(result.tokensSystemPrompt).toBeNull();
    expect(result.tokensSystemTools).toBeNull();
    expect(result.tokensMcpTools).toBeNull();
    expect(result.tokensMemoryFiles).toBeNull();
    expect(result.tokensMessages).toBeNull();
  });

  it('should handle missing total tokens line', () => {
    const noTotalOutput = `Context Usage

System prompt: 4.6k tokens (2.3%)
System tools: 15.0k tokens (7.5%)
MCP tools: 94.6k tokens (47.3%)
Memory files: 5.4k tokens (2.7%)
Messages: 6.2k tokens (3.1%)`;

    const result = parseContextOutput(noTotalOutput);

    expect(result.tokensInput).toBeNull();
    expect(result.tokensSystemPrompt).toBe(4600);
    expect(result.tokensSystemTools).toBe(15000);
    expect(result.tokensMcpTools).toBe(94600);
    expect(result.tokensMemoryFiles).toBe(5400);
    expect(result.tokensMessages).toBe(6200);
  });

  it('should handle different model names', () => {
    const differentModelOutput = `Context Usage
claude-sonnet-4-5-20250929 · 48k/200k tokens (24%)

System prompt: 2.3k tokens (4.8%)
System tools: 10.0k tokens (20.8%)
MCP tools: 30.5k tokens (63.5%)
Memory files: 3.2k tokens (6.7%)
Messages: 2.0k tokens (4.2%)`;

    const result = parseContextOutput(differentModelOutput);

    expect(result.tokensInput).toBe(48000);
    expect(result.tokensSystemPrompt).toBe(2300);
    expect(result.tokensSystemTools).toBe(10000);
    expect(result.tokensMcpTools).toBe(30500);
    expect(result.tokensMemoryFiles).toBe(3200);
    expect(result.tokensMessages).toBe(2000);
  });

  it('should handle whole number token values (no k suffix)', () => {
    const wholeNumberOutput = `Context Usage
claude-opus-4-5-20251101 · 171000/200000 tokens (85%)

System prompt: 4600 tokens (2.3%)
System tools: 15000 tokens (7.5%)
MCP tools: 94600 tokens (47.3%)
Memory files: 5400 tokens (2.7%)
Messages: 6200 tokens (3.1%)`;

    const result = parseContextOutput(wholeNumberOutput);

    expect(result.tokensInput).toBe(171000);
    expect(result.tokensSystemPrompt).toBe(4600);
    expect(result.tokensSystemTools).toBe(15000);
    expect(result.tokensMcpTools).toBe(94600);
    expect(result.tokensMemoryFiles).toBe(5400);
    expect(result.tokensMessages).toBe(6200);
  });

  it('should handle edge case with zero tokens', () => {
    const zeroTokensOutput = `Context Usage
claude-opus-4-5-20251101 · 50k/200k tokens (25%)

System prompt: 0k tokens (0%)
System tools: 0k tokens (0%)
MCP tools: 50k tokens (100%)
Memory files: 0k tokens (0%)
Messages: 0k tokens (0%)`;

    const result = parseContextOutput(zeroTokensOutput);

    expect(result.tokensInput).toBe(50000);
    expect(result.tokensSystemPrompt).toBe(0);
    expect(result.tokensSystemTools).toBe(0);
    expect(result.tokensMcpTools).toBe(50000);
    expect(result.tokensMemoryFiles).toBe(0);
    expect(result.tokensMessages).toBe(0);
  });
});
