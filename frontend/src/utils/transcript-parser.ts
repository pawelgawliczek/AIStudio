/**
 * ST-173: Transcript Parser
 *
 * Parses JSONL transcripts from Claude Code sessions with comprehensive security.
 *
 * Security Requirements (from SECURITY_REVIEW):
 * - Test Case 5: XSS prevention via DOMPurify sanitization
 * - JSONL injection protection (prototype pollution, schema validation)
 * - Content length limits to prevent DoS
 */

import DOMPurify from 'dompurify';

// =============================================================================
// Types
// =============================================================================

export interface ParsedTranscript {
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

export interface ConversationTurn {
  type: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ToolCall {
  name: string;
  input: unknown;
}

export interface ToolResult {
  name: string;
  output: unknown;
}

// Internal type for raw JSONL records (Claude Code format)
interface RawRecord {
  type: 'user' | 'assistant' | 'file-history-snapshot' | string;
  timestamp?: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  toolUseResult?: {
    type: string;
    tool_use_id: string;
    content: string;
  };
}

// Content block types for assistant messages
interface ContentBlock {
  type: 'text' | 'tool_use' | 'thinking' | 'tool_result';
  text?: string;
  name?: string;
  input?: unknown;
  content?: string;
  tool_use_id?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Security limits
const MAX_CONTENT_LENGTH = 10000; // 10KB per record
const MAX_TRANSCRIPT_LINES = 10000; // 10,000 lines max

// Valid record types (whitelist) - Claude Code transcript format
const VALID_TYPES = new Set(['user', 'assistant', 'file-history-snapshot', 'system']);

// Prototype pollution detection patterns
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

// MCP tool prefix for master transcript detection
const MCP_TOOL_PREFIX = 'mcp__';

// =============================================================================
// TranscriptParser Class
// =============================================================================

export class TranscriptParser {
  /**
   * Parse raw JSONL transcript into structured conversation
   *
   * @param rawTranscript - Raw JSONL string from transcript file
   * @returns Parsed transcript with turns, metadata, and metrics
   * @throws Error if transcript exceeds limits or contains invalid data
   */
  parseJSONL(rawTranscript: string): ParsedTranscript {
    // Handle empty input
    if (!rawTranscript || rawTranscript.trim() === '') {
      return this.createEmptyTranscript();
    }

    // Split into lines
    const lines = rawTranscript.split('\n');

    // Check line count limit
    if (lines.length > MAX_TRANSCRIPT_LINES) {
      throw new Error(`Transcript too large: exceeds 10,000 lines limit`);
    }

    // Parse each line
    const records: RawRecord[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // Skip empty lines

      try {
        const parsed = JSON.parse(trimmed);

        // Security: Validate record schema (returns false for unknown types to skip)
        const isValid = this.validateRecord(parsed);
        if (!isValid) {
          continue; // Skip unknown record types
        }

        records.push(parsed);
      } catch (e) {
        // Re-throw security violations (prototype pollution, content too large)
        if (e instanceof Error && e.message.includes('Invalid record schema')) {
          throw e;
        }
        // Skip malformed JSON lines (graceful degradation for partial/streaming content)
        continue;
      }
    }

    // Group into conversation turns
    const turns = this.groupIntoTurns(records);

    // Extract metadata
    const metadata = this.extractMetadata(records);

    // Calculate metrics
    const metrics = this.calculateMetrics(records);

    return { metadata, turns, metrics };
  }

  /**
   * Detect transcript type based on tool usage patterns (Claude Code format)
   */
  detectType(records: RawRecord[]): 'master' | 'agent' {
    // Master transcripts use MCP tools (mcp__vibestudio__*, mcp__playwright__*)
    for (const record of records) {
      if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
        for (const block of record.message.content) {
          if (block.type === 'tool_use' && block.name?.startsWith(MCP_TOOL_PREFIX)) {
            return 'master';
          }
        }
      }
    }
    // Default to agent (implementation transcripts)
    return 'agent';
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Validate record against security constraints (Claude Code format)
   * Returns false for records that should be skipped (unknown types)
   * Throws for security violations (prototype pollution, content too large)
   */
  private validateRecord(record: unknown): boolean {
    if (typeof record !== 'object' || record === null) {
      throw new Error('Invalid record schema: not an object');
    }

    const obj = record as Record<string, unknown>;

    // Check for prototype pollution attempts (use hasOwnProperty to check own properties only, not prototype chain)
    for (const key of FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        throw new Error(`Invalid record schema: forbidden key "${key}"`);
      }
    }

    // Skip unknown record types gracefully (Claude Code may have many types)
    // Only process known types: user, assistant, file-history-snapshot, system
    if ('type' in obj) {
      if (!VALID_TYPES.has(obj.type as string)) {
        // Skip unknown types instead of throwing - more robust for live streaming
        return false;
      }
    }

    // Validate message content length if present
    const message = obj.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') {
      if (message.content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Content too large: ${message.content.length} chars (max: ${MAX_CONTENT_LENGTH})`);
      }
    }

    return true;
  }

  /**
   * Group records into conversation turns
   * Handles Claude Code transcript format where:
   * - type: 'user' | 'assistant' | 'file-history-snapshot'
   * - message.content: string (user) or ContentBlock[] (assistant)
   */
  private groupIntoTurns(records: RawRecord[]): ConversationTurn[] {
    const turns: ConversationTurn[] = [];

    for (const record of records) {
      // Skip file-history-snapshot records
      if (record.type === 'file-history-snapshot') {
        continue;
      }

      // Skip records without messages
      if (!record.message) {
        continue;
      }

      if (record.type === 'user') {
        // User message - content is a string
        const content = typeof record.message.content === 'string'
          ? record.message.content
          : '';

        // Skip command messages and empty content
        if (!content || content.includes('<command-name>') || content.includes('<local-command-stdout>')) {
          continue;
        }

        turns.push({
          type: 'user',
          timestamp: record.timestamp || new Date().toISOString(),
          content: this.sanitizeContent(content),
        });
      } else if (record.type === 'assistant') {
        // Assistant message - content is array of ContentBlock
        const contentBlocks = Array.isArray(record.message.content)
          ? record.message.content
          : [];

        // Extract text content
        const textContent = contentBlocks
          .filter((block): block is ContentBlock => block.type === 'text' && !!block.text)
          .map(block => block.text!)
          .join('\n');

        // Extract tool calls
        const toolCalls = contentBlocks
          .filter((block): block is ContentBlock => block.type === 'tool_use' && !!block.name)
          .map(block => ({
            name: block.name!,
            input: block.input,
          }));

        // Skip thinking-only turns with no text/tools
        if (!textContent && toolCalls.length === 0) {
          continue;
        }

        const turn: ConversationTurn = {
          type: 'assistant',
          timestamp: record.timestamp || new Date().toISOString(),
          content: this.sanitizeContent(textContent),
        };

        if (toolCalls.length > 0) {
          turn.toolCalls = toolCalls;
        }

        // Add usage if available
        if (record.message.usage) {
          turn.usage = {
            inputTokens: record.message.usage.input_tokens || 0,
            outputTokens: record.message.usage.output_tokens || 0,
          };
        }

        turns.push(turn);
      }
    }

    return turns;
  }

  /**
   * Map raw record type to conversation turn type (Claude Code format)
   * In this format, record.type directly maps to user/assistant
   */
  private mapRecordType(record: RawRecord): 'user' | 'assistant' | 'system' {
    if (record.type === 'system') {
      return 'system';
    }
    if (record.type === 'user') {
      return 'user';
    }
    return 'assistant';
  }

  /**
   * Sanitize content using DOMPurify to prevent XSS
   * Also escapes HTML entities for safe display
   *
   * Strategy:
   * 1. Use DOMPurify to detect and remove dangerous content (scripts, event handlers)
   * 2. For safe HTML, escape all tags for display as code
   */
  private sanitizeContent(content: string): string {
    // Check if content contains dangerous patterns that should be stripped completely
    const dangerousPatterns = [
      /<script[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /data:/gi,
      /onerror\s*=/gi,
      /onload\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
    ];

    let cleanContent = content;

    // Check for dangerous patterns and use DOMPurify for those
    const hasDangerousContent = dangerousPatterns.some(pattern => pattern.test(content));

    if (hasDangerousContent) {
      // Use DOMPurify to strip dangerous content
      cleanContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [], // Strip ALL HTML tags
        ALLOWED_ATTR: [], // Strip ALL attributes
        KEEP_CONTENT: false, // Don't keep content of dangerous tags
      });
    }

    // Escape remaining HTML entities for safe display
    return this.escapeHtml(cleanContent);
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(str: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return str.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
  }

  /**
   * Extract metadata from records (Claude Code format)
   */
  private extractMetadata(records: RawRecord[]): ParsedTranscript['metadata'] {
    let sessionId = 'unknown';
    let model = 'unknown';

    for (const record of records) {
      // Extract session ID from any record that has it
      if (sessionId === 'unknown' && record.sessionId) {
        sessionId = record.sessionId;
      }

      // Extract model from first assistant message
      if (model === 'unknown' && record.type === 'assistant' && record.message?.model) {
        model = record.message.model;
      }
    }

    return {
      sessionId,
      model,
      transcriptType: this.detectType(records),
    };
  }

  /**
   * Calculate token metrics from all records (Claude Code format)
   */
  private calculateMetrics(records: RawRecord[]): ParsedTranscript['metrics'] {
    let inputTokens = 0;
    let outputTokens = 0;

    for (const record of records) {
      // Claude Code format: usage is in message.usage
      if (record.message?.usage) {
        inputTokens += record.message.usage.input_tokens || 0;
        outputTokens += record.message.usage.output_tokens || 0;
      }
    }

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  /**
   * Create empty transcript structure
   */
  private createEmptyTranscript(): ParsedTranscript {
    return {
      metadata: {
        sessionId: 'unknown',
        model: 'unknown',
        transcriptType: 'agent',
      },
      turns: [],
      metrics: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    };
  }
}

// Export singleton instance for convenience
export const transcriptParser = new TranscriptParser();
