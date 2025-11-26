#!/usr/bin/env npx tsx
/**
 * CLI tool to parse Claude Code transcript files and output token metrics
 *
 * Usage:
 *   npx tsx scripts/parse-transcript.ts <transcript-path>
 *   npx tsx scripts/parse-transcript.ts --latest [project-path]
 *
 * Examples:
 *   npx tsx scripts/parse-transcript.ts ~/.claude/projects/-Users-pawelgawliczek-projects-AIStudio/abc123.jsonl
 *   npx tsx scripts/parse-transcript.ts --latest /Users/pawelgawliczek/projects/AIStudio
 *   npx tsx scripts/parse-transcript.ts --latest  # uses current directory
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

  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheCreation = 0;
  let totalCacheRead = 0;
  let model = 'unknown';

  for (const record of records) {
    if (record.message?.model) {
      model = record.message.model;
    }
    if (record.message?.usage) {
      const usage = record.message.usage;
      totalInput += usage.input_tokens ?? 0;
      totalOutput += usage.output_tokens ?? 0;
      totalCacheCreation += usage.cache_creation_input_tokens ?? 0;
      totalCacheRead += usage.cache_read_input_tokens ?? 0;
    }
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
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fsSync.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/parse-transcript.ts <transcript-path>');
    console.error('       npx tsx scripts/parse-transcript.ts --latest [project-path]');
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
