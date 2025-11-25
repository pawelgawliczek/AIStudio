/**
 * ST-110: Parse /context command output to extract token breakdown
 *
 * Replaces legacy transcript parsing with Claude Code's native /context command
 */

export interface ContextMetrics {
  tokensInput: number | null; // Total context tokens used
  tokensSystemPrompt: number | null; // System prompt tokens
  tokensSystemTools: number | null; // System tools tokens
  tokensMcpTools: number | null; // MCP tools tokens
  tokensMemoryFiles: number | null; // Memory files tokens
  tokensMessages: number | null; // User/assistant messages tokens
}

const NULL_METRICS: ContextMetrics = {
  tokensInput: null,
  tokensSystemPrompt: null,
  tokensSystemTools: null,
  tokensMcpTools: null,
  tokensMemoryFiles: null,
  tokensMessages: null,
};

/**
 * Parse token value from /context output
 * Handles both "k" suffix and whole numbers
 * Examples: "4.6k" → 4600, "171k" → 171000, "4600" → 4600
 */
export function parseTokenValue(value: string): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Handle "k" suffix (e.g., "4.6k", "171k")
  if (trimmed.endsWith('k')) {
    const numericPart = trimmed.slice(0, -1);
    const parsed = parseFloat(numericPart);
    if (isNaN(parsed)) {
      return null;
    }
    return Math.round(parsed * 1000);
  }

  // Handle whole numbers (e.g., "4600", "171000")
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * Extract token value from a line matching pattern
 * Example: "System prompt: 4.6k tokens (2.3%)" → 4600
 */
function extractTokensFromLine(line: string, pattern: RegExp): number | null {
  const match = line.match(pattern);
  if (!match || !match[1]) {
    return null;
  }
  return parseTokenValue(match[1]);
}

/**
 * Parse /context command output to extract token breakdown
 *
 * Example input:
 * ```
 * Context Usage
 * claude-opus-4-5-20251101 · 171k/200k tokens (85%)
 *
 * System prompt: 4.6k tokens (2.3%)
 * System tools: 15.0k tokens (7.5%)
 * MCP tools: 94.6k tokens (47.3%)
 * Memory files: 5.4k tokens (2.7%)
 * Messages: 6.2k tokens (3.1%)
 * ```
 *
 * Returns:
 * ```
 * {
 *   tokensInput: 171000,
 *   tokensSystemPrompt: 4600,
 *   tokensSystemTools: 15000,
 *   tokensMcpTools: 94600,
 *   tokensMemoryFiles: 5400,
 *   tokensMessages: 6200
 * }
 * ```
 */
export function parseContextOutput(contextOutput: string): ContextMetrics {
  if (!contextOutput || typeof contextOutput !== 'string') {
    return NULL_METRICS;
  }

  const lines = contextOutput.split('\n');
  const metrics: ContextMetrics = { ...NULL_METRICS };

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract total tokens from header line
    // Pattern: "claude-* · 171k/200k tokens (85%)"
    const totalMatch = trimmed.match(/(\d+\.?\d*k?)\s*\/\s*\d+\.?\d*k?\s+tokens/i);
    if (totalMatch && totalMatch[1]) {
      metrics.tokensInput = parseTokenValue(totalMatch[1]);
      continue;
    }

    // Extract System prompt tokens
    if (trimmed.toLowerCase().startsWith('system prompt:')) {
      metrics.tokensSystemPrompt = extractTokensFromLine(
        trimmed,
        /system prompt:\s*([0-9.]+k?)\s+tokens/i,
      );
      continue;
    }

    // Extract System tools tokens
    if (trimmed.toLowerCase().startsWith('system tools:')) {
      metrics.tokensSystemTools = extractTokensFromLine(
        trimmed,
        /system tools:\s*([0-9.]+k?)\s+tokens/i,
      );
      continue;
    }

    // Extract MCP tools tokens
    if (trimmed.toLowerCase().startsWith('mcp tools:')) {
      metrics.tokensMcpTools = extractTokensFromLine(
        trimmed,
        /mcp tools:\s*([0-9.]+k?)\s+tokens/i,
      );
      continue;
    }

    // Extract Memory files tokens
    if (trimmed.toLowerCase().startsWith('memory files:')) {
      metrics.tokensMemoryFiles = extractTokensFromLine(
        trimmed,
        /memory files:\s*([0-9.]+k?)\s+tokens/i,
      );
      continue;
    }

    // Extract Messages tokens
    if (trimmed.toLowerCase().startsWith('messages:')) {
      metrics.tokensMessages = extractTokensFromLine(
        trimmed,
        /messages:\s*([0-9.]+k?)\s+tokens/i,
      );
      continue;
    }
  }

  return metrics;
}
