import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import * as path from 'path';

/**
 * Token metrics extracted from agent transcript
 */
export interface AgentTranscriptMetrics {
  agentId: string;
  sessionId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

/**
 * Options for transcript parsing
 */
export interface TranscriptParseOptions {
  /**
   * Sum all messages (default: true)
   * If false, only return metrics from last message
   */
  aggregateUsage?: boolean;

  /**
   * Include agent/session metadata (default: true)
   */
  includeMetadata?: boolean;
}

/**
 * Raw transcript record structure
 */
interface TranscriptRecord {
  agentId?: string;
  sessionId?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

/**
 * Service for parsing agent transcript JSONL files to extract token metrics
 *
 * This service is used to capture token usage from spawned component agents.
 * Orchestrator agents use the /context command (ST-110 pattern).
 *
 * Use Cases:
 * - UC-EXEC-012: Parse Agent Transcript JSONL Files for Token Metrics
 */
@Injectable()
export class TranscriptParserService {
  private readonly logger = new Logger(TranscriptParserService.name);

  /**
   * Maximum transcript file size (5 MB)
   * Prevents DoS from maliciously large files
   */
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  /**
   * Parse agent transcript JSONL file to extract token metrics
   *
   * Reads transcript file line-by-line (streaming) and aggregates
   * token usage across all messages.
   *
   * Error Handling Philosophy: Graceful degradation
   * - File not found → return null (log warning)
   * - Invalid JSON → skip line, continue (log error with line number)
   * - Missing fields → use zeros (log warning)
   * - Permission denied → return null (log error)
   *
   * @param transcriptPath - Absolute path to agent transcript file
   * @param options - Parsing options (defaults: aggregate=true, includeMetadata=true)
   * @returns Aggregated token metrics or null if parsing fails
   */
  async parseAgentTranscript(
    transcriptPath: string,
    options?: TranscriptParseOptions,
  ): Promise<AgentTranscriptMetrics | null> {
    const opts: Required<TranscriptParseOptions> = {
      aggregateUsage: options?.aggregateUsage ?? true,
      includeMetadata: options?.includeMetadata ?? true,
    };

    try {
      // Validate file exists and is readable
      const stats = await fs.stat(transcriptPath);

      // Check file size limit
      if (stats.size > this.MAX_FILE_SIZE) {
        this.logger.error(
          `Transcript file too large: ${stats.size} bytes (max ${this.MAX_FILE_SIZE})`,
          { transcriptPath },
        );
        return null;
      }

      // Handle empty file
      if (stats.size === 0) {
        this.logger.warn('Transcript file is empty', { transcriptPath });
        return null;
      }

      // Parse JSONL file
      const records = await this.parseJSONL(transcriptPath);

      if (records.length === 0) {
        this.logger.warn('No valid records found in transcript', {
          transcriptPath,
        });
        return null;
      }

      // Extract agent ID from filename (fallback if not in records)
      const agentIdFromFilename = this.extractAgentIdFromPath(transcriptPath);

      // Aggregate metrics
      return this.aggregateMetrics(records, agentIdFromFilename, opts);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warn('Transcript file not found', { transcriptPath });
      } else if ((err as NodeJS.ErrnoException).code === 'EACCES') {
        this.logger.error('Permission denied reading transcript file', {
          transcriptPath,
          error: err,
        });
      } else {
        this.logger.error('Unexpected error parsing transcript', {
          transcriptPath,
          error: err,
        });
      }
      return null;
    }
  }

  /**
   * Parse JSONL file line-by-line (streaming)
   *
   * Memory-efficient approach for potentially large transcript files.
   * Recovers from malformed JSON lines by skipping and continuing.
   *
   * @param filePath - Path to JSONL file
   * @returns Array of parsed records (malformed lines excluded)
   */
  private async parseJSONL(filePath: string): Promise<TranscriptRecord[]> {
    const records: TranscriptRecord[] = [];
    const fileHandle = await fs.open(filePath, 'r');

    try {
      const rl = readline.createInterface({
        input: fileHandle.createReadStream(),
        crlfDelay: Infinity,
      });

      let lineNumber = 0;
      for await (const line of rl) {
        lineNumber++;

        // Skip empty lines
        if (!line.trim()) {
          continue;
        }

        try {
          const record = JSON.parse(line) as TranscriptRecord;
          records.push(record);
        } catch (parseErr) {
          this.logger.error(
            `Malformed JSON at line ${lineNumber}, skipping`,
            {
              filePath,
              lineNumber,
              error: parseErr,
            },
          );
          // Continue processing remaining lines
        }
      }
    } finally {
      await fileHandle.close();
    }

    return records;
  }

  /**
   * Aggregate token metrics from multiple transcript records
   *
   * @param records - Parsed transcript records
   * @param fallbackAgentId - Agent ID from filename (fallback)
   * @param options - Parsing options
   * @returns Aggregated metrics
   */
  private aggregateMetrics(
    records: TranscriptRecord[],
    fallbackAgentId: string | null,
    options: Required<TranscriptParseOptions>,
  ): AgentTranscriptMetrics | null {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheCreation = 0;
    let totalCacheRead = 0;
    let agentId: string | null = null;
    let sessionId: string | null = null;
    let model = 'unknown';

    for (const record of records) {
      // Extract metadata from first record (or override with later records)
      if (record.agentId) {
        agentId = record.agentId;
      }
      if (record.sessionId) {
        sessionId = record.sessionId;
      }
      if (record.message?.model) {
        model = record.message.model; // Use last model seen
      }

      // Aggregate usage
      if (record.message?.usage) {
        const usage = record.message.usage;
        totalInput += usage.input_tokens ?? 0;
        totalOutput += usage.output_tokens ?? 0;
        totalCacheCreation += usage.cache_creation_input_tokens ?? 0;
        totalCacheRead += usage.cache_read_input_tokens ?? 0;
      }
    }

    // Use fallback agent ID if not found in records
    const finalAgentId = agentId ?? fallbackAgentId ?? 'unknown';

    // Calculate total tokens
    const totalTokens = totalInput + totalOutput;

    return {
      agentId: finalAgentId,
      sessionId,
      model,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCacheCreation,
      cacheReadTokens: totalCacheRead,
      totalTokens,
    };
  }

  /**
   * Extract agent ID from transcript file path
   *
   * Expected format: .../agent-{id}.jsonl
   * Example: /home/user/.claude/projects/foo/agent-abc123.jsonl → "abc123"
   *
   * @param filePath - Path to transcript file
   * @returns Agent ID or null if not found
   */
  private extractAgentIdFromPath(filePath: string): string | null {
    const filename = path.basename(filePath, '.jsonl');
    const match = filename.match(/^agent-(.+)$/);
    return match ? match[1] : null;
  }
}
