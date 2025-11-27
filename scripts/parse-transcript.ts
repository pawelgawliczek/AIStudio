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
 *     "transcriptPath": "/path/to/file.jsonl"
 *   }
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

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

interface TranscriptMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  model: string;
  transcriptPath: string;
}

async function parseJSONL(filePath: string): Promise<TranscriptRecord[]> {
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

  // Sum usage from deduplicated messages
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;

  for (const usage of messageUsageMap.values()) {
    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCacheCreation += usage.cache_creation_input_tokens;
    totalCacheRead += usage.cache_read_input_tokens;
  }

  return {
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheCreationTokens: totalCacheCreation,
    cacheReadTokens: totalCacheRead,
    totalTokens: totalInput + totalOutput,
    model,
    transcriptPath,
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
 * Searches only recent agent transcripts (modified in last hour) for efficiency.
 */
function findTranscriptByContent(transcriptDir: string, searchContent: string): string | null {
  if (!fsSync.existsSync(transcriptDir)) {
    return null;
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  // Get recent agent transcripts (modified in last hour)
  const recentAgentFiles = fsSync.readdirSync(transcriptDir)
    .filter(f => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .map(f => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .filter(f => f.mtime.getTime() > oneHourAgo)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // newest first

  // Search each file for the content
  for (const file of recentAgentFiles) {
    try {
      const content = fsSync.readFileSync(file.path, 'utf-8');
      if (content.includes(searchContent)) {
        return file.path;
      }
    } catch {
      // Skip files we can't read
    }
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/parse-transcript.ts <transcript-path>');
    console.error('       npx tsx scripts/parse-transcript.ts --latest [project-path]');
    console.error('       npx tsx scripts/parse-transcript.ts --latest-agent [project-path]');
    console.error('       npx tsx scripts/parse-transcript.ts --agent <agent-id> [project-path]');
    console.error('       npx tsx scripts/parse-transcript.ts --search <content> [project-path]');
    process.exit(1);
  }

  let transcriptPath: string;

  if (args[0] === '--latest') {
    const projectPath = args[1] || process.cwd();
    const transcriptDir = findTranscriptDirectory(projectPath);
    const latest = findLatestTranscript(transcriptDir);

    if (!latest) {
      console.error(JSON.stringify({ error: `No transcripts found in ${transcriptDir}` }));
      process.exit(1);
    }
    transcriptPath = latest;
  } else if (args[0] === '--latest-agent') {
    const projectPath = args[1] || process.cwd();
    const transcriptDir = findTranscriptDirectory(projectPath);
    const latest = findLatestAgentTranscript(transcriptDir);

    if (!latest) {
      console.error(JSON.stringify({ error: `No agent transcripts found in ${transcriptDir}`, hint: 'Agent transcripts are named agent-{uuid}.jsonl' }));
      process.exit(1);
    }
    transcriptPath = latest;
  } else if (args[0] === '--agent') {
    if (!args[1]) {
      console.error(JSON.stringify({ error: 'Agent ID required. Usage: --agent <agent-id> [project-path]' }));
      process.exit(1);
    }
    const agentId = args[1];
    const projectPath = args[2] || process.cwd();
    const transcriptDir = findTranscriptDirectory(projectPath);
    const agentTranscript = findAgentTranscript(transcriptDir, agentId);

    if (!agentTranscript) {
      console.error(JSON.stringify({ error: `No agent transcript found for ID ${agentId} in ${transcriptDir}`, hint: 'Use --latest-agent to find the most recent agent transcript' }));
      process.exit(1);
    }
    transcriptPath = agentTranscript;
  } else if (args[0] === '--search') {
    if (!args[1]) {
      console.error(JSON.stringify({ error: 'Search content required. Usage: --search <content> [project-path]' }));
      process.exit(1);
    }
    const searchContent = args[1];
    const projectPath = args[2] || process.cwd();
    const transcriptDir = findTranscriptDirectory(projectPath);
    const foundTranscript = findTranscriptByContent(transcriptDir, searchContent);

    if (!foundTranscript) {
      console.error(JSON.stringify({
        error: `No agent transcript found containing "${searchContent}" in ${transcriptDir}`,
        hint: 'Searched recent files from last hour. Ensure the content was included in the agent task.'
      }));
      process.exit(1);
    }
    transcriptPath = foundTranscript;
  } else {
    transcriptPath = args[0];
    // Expand ~ to home directory
    if (transcriptPath.startsWith('~')) {
      transcriptPath = path.join(os.homedir(), transcriptPath.slice(1));
    }
  }

  try {
    const metrics = await parseTranscript(transcriptPath);

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
