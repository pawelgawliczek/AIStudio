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

// Internal type for raw JSONL records
interface RawRecord {
  type: string;
  content?: string;
  role?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
  event?: string;
  sessionId?: string;
  model?: string;
  timestamp?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Security limits
const MAX_CONTENT_LENGTH = 10000; // 10KB per record
const MAX_TRANSCRIPT_LINES = 10000; // 10,000 lines max

// Valid record types (whitelist)
const VALID_TYPES = new Set(['text', 'tool_use', 'tool_result', 'system']);

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

        // Security: Validate record schema
        this.validateRecord(parsed);

        records.push(parsed);
      } catch (e) {
        // Skip malformed JSON lines (graceful degradation)
        if (e instanceof Error && e.message.includes('Invalid record')) {
          throw e; // Re-throw validation errors
        }
        // Otherwise skip malformed JSON
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
   * Detect transcript type based on tool usage patterns
   */
  detectType(records: RawRecord[]): 'master' | 'agent' {
    // Master transcripts use MCP tools (mcp__vibestudio__*, mcp__playwright__*)
    for (const record of records) {
      if (record.type === 'tool_use' && record.name) {
        if (record.name.startsWith(MCP_TOOL_PREFIX)) {
          return 'master';
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
   * Validate record against security constraints
   */
  private validateRecord(record: unknown): void {
    if (typeof record !== 'object' || record === null) {
      throw new Error('Invalid record schema: not an object');
    }

    const obj = record as Record<string, unknown>;

    // Check for prototype pollution attempts
    for (const key of FORBIDDEN_KEYS) {
      if (key in obj) {
        throw new Error(`Invalid record schema: forbidden key "${key}"`);
      }
    }

    // Validate type field
    if ('type' in obj) {
      if (!VALID_TYPES.has(obj.type as string)) {
        throw new Error(`Invalid record type: "${obj.type}"`);
      }
    }

    // Validate content length
    if ('content' in obj && typeof obj.content === 'string') {
      if (obj.content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Content too large: ${obj.content.length} chars (max: ${MAX_CONTENT_LENGTH})`);
      }
    }
  }

  /**
   * Group records into conversation turns
   * Tool calls and results are grouped with their parent assistant message
   */
  private groupIntoTurns(records: RawRecord[]): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    let currentTurn: ConversationTurn | null = null;

    for (const record of records) {
      if (record.type === 'text' || record.type === 'system') {
        // Start new turn
        if (currentTurn) {
          turns.push(currentTurn);
        }

        currentTurn = {
          type: this.mapRecordType(record),
          timestamp: record.timestamp || new Date().toISOString(),
          content: this.sanitizeContent(record.content || ''),
          usage: record.usage ? {
            inputTokens: record.usage.inputTokens || 0,
            outputTokens: record.usage.outputTokens || 0,
          } : undefined,
        };
      } else if (record.type === 'tool_use') {
        // Add tool call to current turn
        if (currentTurn) {
          if (!currentTurn.toolCalls) {
            currentTurn.toolCalls = [];
          }
          currentTurn.toolCalls.push({
            name: record.name || 'unknown',
            input: record.input,
          });
        } else {
          // Create implicit turn for orphaned tool call
          currentTurn = {
            type: 'assistant',
            timestamp: record.timestamp || new Date().toISOString(),
            content: '',
            toolCalls: [{
              name: record.name || 'unknown',
              input: record.input,
            }],
          };
        }
      } else if (record.type === 'tool_result') {
        // Add tool result to current turn
        if (currentTurn) {
          if (!currentTurn.toolResults) {
            currentTurn.toolResults = [];
          }
          currentTurn.toolResults.push({
            name: record.name || 'unknown',
            output: record.output,
          });
        }
      }
    }

    // Push final turn
    if (currentTurn) {
      turns.push(currentTurn);
    }

    return turns;
  }

  /**
   * Map raw record type to conversation turn type
   */
  private mapRecordType(record: RawRecord): 'user' | 'assistant' | 'system' {
    if (record.type === 'system') {
      return 'system';
    }
    if (record.role === 'user') {
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
   * Extract metadata from records
   */
  private extractMetadata(records: RawRecord[]): ParsedTranscript['metadata'] {
    let sessionId = 'unknown';
    let model = 'unknown';

    for (const record of records) {
      // Extract session ID from SessionStart event
      if (record.type === 'system' && record.event === 'SessionStart' && record.sessionId) {
        sessionId = record.sessionId;
      }

      // Extract model from first assistant message with model field
      if (model === 'unknown' && record.model) {
        model = record.model;
      }
    }

    return {
      sessionId,
      model,
      transcriptType: this.detectType(records),
    };
  }

  /**
   * Calculate token metrics from all records
   */
  private calculateMetrics(records: RawRecord[]): ParsedTranscript['metrics'] {
    let inputTokens = 0;
    let outputTokens = 0;

    for (const record of records) {
      if (record.usage) {
        inputTokens += record.usage.inputTokens || 0;
        outputTokens += record.usage.outputTokens || 0;
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
