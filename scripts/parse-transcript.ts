#!/usr/bin/env npx tsx
/**
 * CLI tool to parse Claude Code transcript files and output token metrics
 *
 * Usage:
 *   npx tsx scripts/parse-transcript.ts <transcript-path>
 *   npx tsx scripts/parse-transcript.ts --latest [project-path]
 *   npx tsx scripts/parse-transcript.ts --latest-agent [project-path]
 *   npx tsx scripts/parse-transcript.ts --agent <agent-id> [project-path]
 *   npx tsx scripts/parse-transcript.ts --search <content> [project-path]
 *
 * Examples:
 *   npx tsx scripts/parse-transcript.ts ~/.claude/projects/-Users-pawelgawliczek-projects-AIStudio/abc123.jsonl
 *   npx tsx scripts/parse-transcript.ts --latest /Users/pawelgawliczek/projects/AIStudio
 *   npx tsx scripts/parse-transcript.ts --latest  # uses current directory
 *   npx tsx scripts/parse-transcript.ts --latest-agent /Users/pawelgawliczek/projects/AIStudio  # find latest agent transcript
 *   npx tsx scripts/parse-transcript.ts --agent 7527b7d9 /Users/pawelgawliczek/projects/AIStudio  # find specific agent
 *   npx tsx scripts/parse-transcript.ts --search "runId-abc123" /Users/pawelgawliczek/projects/AIStudio  # find by content
 *
 * Output (JSON):
 *   {
 *     "inputTokens": 12345,
 *     "outputTokens": 6789,
 *     "cacheCreationTokens": 100,
 *     "cacheReadTokens": 5000,
 *     "totalTokens": 19134,
 *     "model": "claude-sonnet-4-20250514",
 *     "transcriptPath": "/path/to/file.jsonl",
 *     "turns": {
 *       "totalTurns": 15,      // All user messages (manual + auto)
 *       "manualPrompts": 3,    // Actual user-typed input
 *       "autoContinues": 12    // Auto-continue/confirmation prompts
 *     }
 *   }
 *
 * ST-147: Turn Classification Rules:
 * - 'manual': Actual user-typed prompts requiring thought/decision
 * - 'auto': Auto-continues (slash commands, short confirmations like "yes", "continue")
 * - 'tool_result': Responses to tool calls (not counted as turns)
 * - 'meta': System metadata entries (not counted as turns)
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

export interface TranscriptRecord {
  agentId?: string;
  sessionId?: string;
  type?: string; // 'user', 'assistant', etc.
  isMeta?: boolean;
  message?: {
    id?: string;
    role?: string;
    model?: string;
    content?: string | Array<{ type: string; text?: string; tool_use_id?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

export interface TranscriptMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  model: string;
  transcriptPath: string;
}

// ST-147: Turn Tracking Types
export interface TurnCounts {
  totalTurns: number;      // All user messages (manual + auto)
  manualPrompts: number;   // Actual user-typed input
  autoContinues: number;   // Auto-continue/confirmation prompts
}

export type TurnClassification = 'manual' | 'auto' | 'tool_result' | 'meta';

/**
 * ST-147: Classify a transcript entry as manual input, auto-continue, tool result, or meta
 *
 * Classification rules:
 * - 'meta': System metadata entries (isMeta=true)
 * - 'tool_result': Entries containing tool_use_id (responses to tool calls)
 * - 'auto': Auto-continues (slash commands, local commands, short confirmations)
 * - 'manual': Actual user-typed input requiring thought/decision
 */
export function classifyTurn(record: TranscriptRecord): TurnClassification {
  // Meta entries are system metadata
  if (record.isMeta) return 'meta';

  // Only classify user messages
  if (record.type !== 'user' && record.message?.role !== 'user') return 'meta';

  // Extract content text
  const content = getMessageContent(record);

  // Tool results contain tool_use_id
  if (content.includes('tool_use_id')) return 'tool_result';

  // Auto-continues from slash commands or local commands
  if (content.includes('<local-command-stdout>')) return 'auto';
  if (content.includes('<command-name>')) return 'auto';
  if (content.includes('<command-message>')) return 'auto';
  if (content.includes('<system-reminder>')) return 'auto';

  // Short confirmation responses (auto-continues)
  const trimmedLower = content.trim().toLowerCase();
  if (/^(continue|yes|y|proceed|ok|go|go ahead|)$/i.test(trimmedLower)) return 'auto';

  // Everything else is manual user input
  return 'manual';
}

/**
 * Extract text content from a TranscriptRecord message
 */
function getMessageContent(record: TranscriptRecord): string {
  if (!record.message?.content) return '';

  if (typeof record.message.content === 'string') {
    return record.message.content;
  }

  // Array of content blocks - extract text from each
  return record.message.content
    .map(block => block.text || '')
    .join(' ');
}

/**
 * ST-147: Count turns from transcript records
 *
 * Returns:
 * - totalTurns: All user messages (manual + auto, excluding tool_result and meta)
 * - manualPrompts: User-typed prompts that required thought/decision
 * - autoContinues: Automatic continuations (confirmations, slash commands)
 */
export function countTurns(records: TranscriptRecord[]): TurnCounts {
  let totalTurns = 0;
  let manualPrompts = 0;
  let autoContinues = 0;

  for (const record of records) {
    const classification = classifyTurn(record);

    if (classification === 'manual') {
      totalTurns++;
      manualPrompts++;
    } else if (classification === 'auto') {
      totalTurns++;
      autoContinues++;
    }
    // Skip 'tool_result' and 'meta' - they don't count as user turns
  }

  return { totalTurns, manualPrompts, autoContinues };
}

/**
 * ST-147: Parse transcript and return both token metrics and turn counts
 */
export interface FullTranscriptMetrics extends TranscriptMetrics {
  turns: TurnCounts;
  agentId?: string;   // Claude Code agent ID (8-char hex) - present for spawned agents
  sessionId?: string; // Parent session ID
}

export async function parseJSONL(filePath: string): Promise<TranscriptRecord[]> {
  const records: TranscriptRecord[] = [];
  const fileHandle = await fs.open(filePath, 'r');

  try {
    const rl = readline.createInterface({
      input: fileHandle.createReadStream(),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
  } finally {
    await fileHandle.close();
  }

  return records;
}

async function parseTranscript(transcriptPath: string): Promise<TranscriptMetrics | null> {
  const stats = await fs.stat(transcriptPath);

  if (stats.size === 0 || stats.size > 5 * 1024 * 1024) {
    return null;
  }

  const records = await parseJSONL(transcriptPath);

  if (records.length === 0) {
    return null;
  }

  let model = 'unknown';

  // Deduplicate by message ID - keep LAST occurrence (has final token counts after streaming)
  const messageUsageMap = new Map<string, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  }>();

  for (const record of records) {
    if (record.message?.model) {
      model = record.message.model;
    }
    if (record.message?.usage) {
      const usage = record.message.usage;
      const messageId = record.message?.id;

      if (messageId) {
        // Overwrite with latest occurrence (streaming updates have increasing output tokens)
        messageUsageMap.set(messageId, {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        });
      } else {
        // No message ID - add directly (shouldn't happen but handle gracefully)
        messageUsageMap.set(`no-id-${messageUsageMap.size}`, {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        });
      }
    }
  }

  // Aggregate usage from deduplicated messages
  // ST-194: cache_read_input_tokens is cumulative per message (same context re-read)
  // Use MAX for cache_read, SUM for everything else
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let maxCacheRead = 0;

  for (const usage of Array.from(messageUsageMap.values())) {
    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCacheCreation += usage.cache_creation_input_tokens;
    // ST-194: cache_read is cumulative - take MAX (represents total cached context)
    maxCacheRead = Math.max(maxCacheRead, usage.cache_read_input_tokens);
  }

  return {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: maxCacheRead,
    // ST-194: totalTokens = input + output + cache_creation (billing model)
    // cache_read is already included in input_tokens (it's a subset)
    totalTokens: totalInput + totalOutput + totalCacheCreation,
    model,
    transcriptPath,
  };
}

/**
 * ST-147: Parse transcript and return both token metrics and turn counts
 * This is the full parsing function that includes turn classification.
 */
export async function parseTranscriptWithTurns(transcriptPath: string): Promise<FullTranscriptMetrics | null> {
  const stats = await fs.stat(transcriptPath);

  if (stats.size === 0 || stats.size > 5 * 1024 * 1024) {
    return null;
  }

  const records = await parseJSONL(transcriptPath);

  if (records.length === 0) {
    return null;
  }

  let model = 'unknown';
  let agentId: string | undefined;
  let sessionId: string | undefined;

  // Extract agentId and sessionId from first record (init message)
  const firstRecord = records[0];
  if (firstRecord) {
    if (firstRecord.agentId) {
      agentId = firstRecord.agentId;
    }
    if (firstRecord.sessionId) {
      sessionId = firstRecord.sessionId;
    }
  }

  // Deduplicate by message ID - keep LAST occurrence (has final token counts after streaming)
  const messageUsageMap = new Map<string, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  }>();

  for (const record of records) {
    if (record.message?.model) {
      model = record.message.model;
    }
    if (record.message?.usage) {
      const usage = record.message.usage;
      const messageId = record.message?.id;

      if (messageId) {
        messageUsageMap.set(messageId, {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        });
      } else {
        messageUsageMap.set(`no-id-${messageUsageMap.size}`, {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        });
      }
    }
  }

  // Aggregate usage from deduplicated messages
  // ST-194: cache_read_input_tokens is cumulative per message (same context re-read)
  // Use MAX for cache_read, SUM for everything else
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let maxCacheRead = 0;

  for (const usage of Array.from(messageUsageMap.values())) {
    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCacheCreation += usage.cache_creation_input_tokens;
    // ST-194: cache_read is cumulative - take MAX (represents total cached context)
    maxCacheRead = Math.max(maxCacheRead, usage.cache_read_input_tokens);
  }

  // ST-147: Count turns
  const turns = countTurns(records);

  return {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: maxCacheRead,
    // ST-194: totalTokens = input + output + cache_creation (billing model)
    // cache_read is already included in input_tokens (it's a subset)
    totalTokens: totalInput + totalOutput + totalCacheCreation,
    model,
    transcriptPath,
    turns,
    agentId,
    sessionId,
  };
}

function findTranscriptDirectory(projectPath: string): string {
  // Claude Code stores transcripts in ~/.claude/projects/<escaped-path>/
  // Path escaping: /Users/foo/bar → -Users-foo-bar
  const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');
  return path.join(os.homedir(), '.claude', 'projects', escapedPath);
}

function findLatestTranscript(transcriptDir: string): string | null {
  if (!fsSync.existsSync(transcriptDir)) {
    return null;
  }

  const files = fsSync.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))
    .map(f => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

function findLatestAgentTranscript(transcriptDir: string): string | null {
  if (!fsSync.existsSync(transcriptDir)) {
    return null;
  }

  const files = fsSync.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .map(f => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

function findAgentTranscript(transcriptDir: string, agentId: string): string | null {
  if (!fsSync.existsSync(transcriptDir)) {
    return null;
  }

  // Agent transcripts are named agent-{uuid}.jsonl
  // agentId can be full UUID or partial (first 8 chars)
  const files = fsSync.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .filter(f => {
      const fileAgentId = f.replace('agent-', '').replace('.jsonl', '');
      return fileAgentId === agentId || fileAgentId.startsWith(agentId);
    });

  if (files.length === 0) {
    return null;
  }

  // If multiple matches (unlikely), return most recent
  if (files.length > 1) {
    const sorted = files
      .map(f => ({
        name: f,
        path: path.join(transcriptDir, f),
        mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return sorted[0].path;
  }

  return path.join(transcriptDir, files[0]);
}

/**
 * Find a transcript file containing specific content (e.g., runId, componentId, storyId).
 * Returns the first (most recent) matching file.
 */
function findTranscriptByContent(transcriptDir: string, searchContent: string, searchDays = 7): string | null {
  const results = findAllTranscriptsByContent(transcriptDir, searchContent, searchDays);
  return results.length > 0 ? results[0] : null;
}

/**
 * ST-147: Find ALL transcript files containing specific content.
 * Handles multiple transcripts from compacted/resumed sessions.
 * Searches transcripts from last N days (default: 7).
 */
function findAllTranscriptsByContent(
  transcriptDir: string,
  searchContent: string,
  searchDays = 7
): string[] {
  if (!fsSync.existsSync(transcriptDir)) {
    return [];
  }

  const cutoffTime = Date.now() - searchDays * 24 * 60 * 60 * 1000;

  // Get all transcripts (both agent and main session) within time window
  const transcriptFiles = fsSync.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .filter(f => f.mtime.getTime() > cutoffTime)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // newest first

  const matchingFiles: string[] = [];

  // Search each file for the content
  for (const file of transcriptFiles) {
    try {
      const content = fsSync.readFileSync(file.path, 'utf-8');
      if (content.includes(searchContent)) {
        matchingFiles.push(file.path);
      }
    } catch {
      // Skip files we can't read
    }
  }

  return matchingFiles;
}

/**
 * ST-147: Aggregate metrics from multiple transcript files
 */
async function aggregateTranscriptMetrics(transcriptPaths: string[]): Promise<FullTranscriptMetrics | null> {
  if (transcriptPaths.length === 0) return null;

  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let totalTurns = 0;
  let manualPrompts = 0;
  let autoContinues = 0;
  let model = 'unknown';
  const parsedPaths: string[] = [];

  for (const transcriptPath of transcriptPaths) {
    try {
      const metrics = await parseTranscriptWithTurns(transcriptPath);
      if (metrics) {
        totalInput += metrics.inputTokens;
        totalOutput += metrics.outputTokens;
        totalCacheCreation += metrics.cacheCreationTokens;
        totalCacheRead += metrics.cacheReadTokens;
        totalTurns += metrics.turns.totalTurns;
        manualPrompts += metrics.turns.manualPrompts;
        autoContinues += metrics.turns.autoContinues;
        if (metrics.model !== 'unknown') {
          model = metrics.model;
        }
        parsedPaths.push(transcriptPath);
      }
    } catch {
      // Skip files that fail to parse
    }
  }

  if (parsedPaths.length === 0) return null;

  return {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: totalCacheRead,
    // ST-194: totalTokens = input + output + cache_creation (billing model)
    totalTokens: totalInput + totalOutput + totalCacheCreation,
    model,
    transcriptPath: parsedPaths.join(', '),
    turns: {
      totalTurns,
      manualPrompts,
      autoContinues,
    },
  };
}

/**
 * Parse command line arguments supporting both:
 * - Positional args: --latest /path/to/project
 * - Key=value args: --latest --path=/path/to/project (for remote agent)
 */
function parseArgs(args: string[]): {
  latest?: boolean;
  latestAgent?: boolean;
  agent?: string;
  search?: string;
  file?: string;
  path?: string;
  positionalPath?: string;
  aggregateAll?: boolean;
  searchDays?: number;
} {
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--latest') {
      result.latest = true;
    } else if (arg === '--latest-agent') {
      result.latestAgent = true;
    } else if (arg.startsWith('--agent=')) {
      result.agent = arg.split('=')[1];
    } else if (arg === '--agent' && args[i + 1] && !args[i + 1].startsWith('-')) {
      result.agent = args[++i];
    } else if (arg.startsWith('--search=')) {
      result.search = arg.split('=')[1];
    } else if (arg === '--search' && args[i + 1] && !args[i + 1].startsWith('-')) {
      result.search = args[++i];
    } else if (arg.startsWith('--file=')) {
      result.file = arg.split('=')[1];
    } else if (arg.startsWith('--path=')) {
      result.path = arg.split('=')[1];
    } else if (arg === '--aggregate-all') {
      result.aggregateAll = true;
    } else if (arg.startsWith('--search-days=')) {
      result.searchDays = parseInt(arg.split('=')[1], 10);
    } else if (!arg.startsWith('-')) {
      // Positional argument (project path or transcript file)
      result.positionalPath = arg;
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/parse-transcript.ts <transcript-path>');
    console.error('       npx tsx scripts/parse-transcript.ts --latest [--path=/project/path]');
    console.error('       npx tsx scripts/parse-transcript.ts --latest-agent [--path=/project/path]');
    console.error('       npx tsx scripts/parse-transcript.ts --agent=<id> [--path=/project/path]');
    console.error('       npx tsx scripts/parse-transcript.ts --search=<content> [--path=/project/path]');
    console.error('       npx tsx scripts/parse-transcript.ts --search=<content> --aggregate-all [--search-days=7]');
    console.error('       npx tsx scripts/parse-transcript.ts --file=<filename> [--path=/project/path]');
    process.exit(1);
  }

  const parsed = parseArgs(args);
  const projectPath = parsed.path || parsed.positionalPath || process.cwd();
  const searchDays = parsed.searchDays || 7;

  // ST-147: Handle aggregate-all mode for compacted/resumed sessions
  if (parsed.search && parsed.aggregateAll) {
    const transcriptDir = findTranscriptDirectory(projectPath);
    const allTranscripts = findAllTranscriptsByContent(transcriptDir, parsed.search, searchDays);

    if (allTranscripts.length === 0) {
      console.error(JSON.stringify({
        error: `No transcripts found containing "${parsed.search}" in ${transcriptDir}`,
        hint: `Searched last ${searchDays} days. Use --search-days=N to extend search window.`
      }));
      process.exit(1);
    }

    try {
      const aggregatedMetrics = await aggregateTranscriptMetrics(allTranscripts);

      if (!aggregatedMetrics) {
        console.error(JSON.stringify({
          error: 'Failed to parse any of the matching transcripts',
          transcriptPaths: allTranscripts
        }));
        process.exit(1);
      }

      // Include extra info about aggregation
      console.log(JSON.stringify({
        ...aggregatedMetrics,
        aggregated: true,
        transcriptCount: allTranscripts.length,
        transcriptPaths: allTranscripts,
      }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: String(err), transcriptPaths: allTranscripts }));
      process.exit(1);
    }
    return;
  }

  let transcriptPath: string;

  if (parsed.file) {
    // Specific file requested
    if (parsed.file.startsWith('/') || parsed.file.startsWith('~')) {
      transcriptPath = parsed.file;
      if (transcriptPath.startsWith('~')) {
        transcriptPath = path.join(os.homedir(), transcriptPath.slice(1));
      }
    } else {
      const transcriptDir = findTranscriptDirectory(projectPath);
      transcriptPath = path.join(transcriptDir, parsed.file);
    }
  } else if (parsed.latest) {
    const transcriptDir = findTranscriptDirectory(projectPath);
    const latest = findLatestTranscript(transcriptDir);

    if (!latest) {
      console.error(JSON.stringify({ error: `No transcripts found in ${transcriptDir}` }));
      process.exit(1);
    }
    transcriptPath = latest;
  } else if (parsed.latestAgent) {
    const transcriptDir = findTranscriptDirectory(projectPath);
    const latest = findLatestAgentTranscript(transcriptDir);

    if (!latest) {
      console.error(JSON.stringify({ error: `No agent transcripts found in ${transcriptDir}`, hint: 'Agent transcripts are named agent-{uuid}.jsonl' }));
      process.exit(1);
    }
    transcriptPath = latest;
  } else if (parsed.agent) {
    const transcriptDir = findTranscriptDirectory(projectPath);
    const agentTranscript = findAgentTranscript(transcriptDir, parsed.agent);

    if (!agentTranscript) {
      console.error(JSON.stringify({ error: `No agent transcript found for ID ${parsed.agent} in ${transcriptDir}`, hint: 'Use --latest-agent to find the most recent agent transcript' }));
      process.exit(1);
    }
    transcriptPath = agentTranscript;
  } else if (parsed.search) {
    const transcriptDir = findTranscriptDirectory(projectPath);
    const foundTranscript = findTranscriptByContent(transcriptDir, parsed.search, searchDays);

    if (!foundTranscript) {
      console.error(JSON.stringify({
        error: `No transcript found containing "${parsed.search}" in ${transcriptDir}`,
        hint: `Searched last ${searchDays} days. Use --aggregate-all to find and combine ALL matching transcripts (for compacted/resumed sessions).`
      }));
      process.exit(1);
    }
    transcriptPath = foundTranscript;
  } else if (parsed.positionalPath) {
    // Assume it's a direct transcript path
    transcriptPath = parsed.positionalPath;
    if (transcriptPath.startsWith('~')) {
      transcriptPath = path.join(os.homedir(), transcriptPath.slice(1));
    }
  } else {
    console.error(JSON.stringify({ error: 'No transcript path or search option provided' }));
    process.exit(1);
  }

  try {
    // ST-147: Use parseTranscriptWithTurns to include turn metrics
    const metrics = await parseTranscriptWithTurns(transcriptPath);

    if (!metrics) {
      console.error(JSON.stringify({ error: 'Failed to parse transcript', path: transcriptPath }));
      process.exit(1);
    }

    console.log(JSON.stringify(metrics, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: String(err), path: transcriptPath }));
    process.exit(1);
  }
}

main();
