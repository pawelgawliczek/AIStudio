/**
 * Stream Parser
 * Parses JSONL stream output from Claude Code CLI
 * Extracts MasterResponse blocks from output
 */

import {
  MasterResponse,
  DEFAULT_MASTER_RESPONSE,
  isValidMasterResponse,
} from '../types';

/**
 * Pattern to match MasterResponse JSON blocks
 * Matches: ```json:master-response\n{...}\n```
 */
const MASTER_RESPONSE_PATTERN = /```json:master-response\s*\n([\s\S]*?)\n```/;

/**
 * JSONL record from Claude Code output
 */
export interface TranscriptRecord {
  type?: string;
  message?: {
    id?: string;
    model?: string;
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  timestamp?: string;
}

/**
 * Token metrics extracted from transcript
 */
export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  model?: string;
}

/**
 * Stream parser for Claude Code CLI output
 */
export class StreamParser {
  private buffer: string = '';
  private records: TranscriptRecord[] = [];

  /**
   * Append data to buffer
   */
  append(data: string): void {
    this.buffer += data;
  }

  /**
   * Parse a single JSONL line
   */
  parseLine(line: string): TranscriptRecord | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    try {
      const record = JSON.parse(trimmed) as TranscriptRecord;
      this.records.push(record);
      return record;
    } catch {
      // Not valid JSON, ignore
      return null;
    }
  }

  /**
   * Parse all complete lines in buffer
   */
  parseBuffer(): TranscriptRecord[] {
    const lines = this.buffer.split('\n');
    const results: TranscriptRecord[] = [];

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const record = this.parseLine(line);
      if (record) {
        results.push(record);
      }
    }

    return results;
  }

  /**
   * Check if buffer contains a complete MasterResponse
   */
  hasCompleteResponse(): boolean {
    return MASTER_RESPONSE_PATTERN.test(this.buffer);
  }

  /**
   * Extract MasterResponse from buffer
   */
  extractMasterResponse(): MasterResponse {
    const match = this.buffer.match(MASTER_RESPONSE_PATTERN);

    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (isValidMasterResponse(parsed)) {
          return parsed;
        }
        console.warn('[StreamParser] MasterResponse validation failed, using default');
      } catch (error) {
        console.warn('[StreamParser] Failed to parse MasterResponse JSON:', error);
      }
    }

    // Return default response if no valid response found
    return DEFAULT_MASTER_RESPONSE;
  }

  /**
   * Extract text content from all records
   */
  extractTextContent(): string {
    const texts: string[] = [];

    for (const record of this.records) {
      if (record.message?.content) {
        for (const block of record.message.content) {
          if (block.type === 'text' && block.text) {
            texts.push(block.text);
          }
        }
      }
    }

    return texts.join('\n');
  }

  /**
   * Calculate token metrics from all records
   * Uses deduplication by message ID (keeps last occurrence)
   */
  calculateMetrics(): TokenMetrics {
    const messageMap = new Map<string, TranscriptRecord>();

    // Deduplicate by message ID, keeping last occurrence
    for (const record of this.records) {
      const messageId = record.message?.id;
      if (messageId) {
        messageMap.set(messageId, record);
      }
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let model: string | undefined;

    for (const record of messageMap.values()) {
      const usage = record.message?.usage;
      if (usage) {
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
        cacheCreationTokens += usage.cache_creation_input_tokens || 0;
        cacheReadTokens += usage.cache_read_input_tokens || 0;
      }

      if (record.message?.model && !model) {
        model = record.message.model;
      }
    }

    return {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens: inputTokens + outputTokens,
      model,
    };
  }

  /**
   * Get raw buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Get all parsed records
   */
  getRecords(): TranscriptRecord[] {
    return [...this.records];
  }

  /**
   * Clear buffer and records
   */
  clear(): void {
    this.buffer = '';
    this.records = [];
  }
}

/**
 * Parse MasterResponse from text output
 * Utility function for one-shot parsing
 */
export function parseMasterResponse(output: string): MasterResponse {
  const parser = new StreamParser();
  parser.append(output);
  return parser.extractMasterResponse();
}

/**
 * Parse JSONL file content
 */
export function parseJSONL(content: string): TranscriptRecord[] {
  const parser = new StreamParser();
  const lines = content.split('\n');

  for (const line of lines) {
    parser.parseLine(line);
  }

  return parser.getRecords();
}
