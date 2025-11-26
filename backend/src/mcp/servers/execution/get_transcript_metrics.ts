/**
 * Get Transcript Metrics Tool
 *
 * Dual-mode tool for extracting token metrics from Claude Code transcripts:
 * - LOCAL mode: Parses transcript files directly from ~/.claude/projects/
 * - REMOTE mode: Returns command for Claude to run locally
 *
 * This enables universal transcript parsing regardless of where the MCP server runs.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_transcript_metrics',
  description: `Get token metrics from Claude Code transcript files.

DUAL-MODE OPERATION:
- If MCP server runs LOCALLY: Parses transcript and returns metrics directly
- If MCP server runs REMOTELY (via SSH): Returns { runLocally: true, command: "..." }

When runLocally=true, execute the returned command via Bash tool, then pass the
JSON output to record_component_complete as transcriptMetrics parameter.

Example flow:
1. Call get_transcript_metrics({ projectPath: "/path/to/project" })
2. If runLocally=true: Run the command locally via Bash
3. Parse JSON output
4. Call record_component_complete({ ..., transcriptMetrics: parsedOutput })`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description:
          'Project path to find transcripts for. If not provided, uses PROJECT_HOST_PATH env or current working directory.',
      },
      transcriptFile: {
        type: 'string',
        description:
          'Specific transcript filename (e.g., "abc123.jsonl"). If not provided, uses most recently modified transcript.',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['transcript', 'metrics', 'tokens', 'tracking'],
  version: '1.0.0',
  since: '2025-11-26',
};

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
  const fsPromises = await import('fs/promises');
  const fileHandle = await fsPromises.open(filePath, 'r');

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
  const fsPromises = await import('fs/promises');
  const stats = await fsPromises.stat(transcriptPath);

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
  const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');
  return path.join(os.homedir(), '.claude', 'projects', escapedPath);
}

function findLatestTranscript(transcriptDir: string): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const files = fs
    .readdirSync(transcriptDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

export async function handler(_prisma: PrismaClient, params: any) {
  // Detect if running remotely via SSH
  const isRunningRemotely = !!process.env.SSH_CONNECTION;

  // Determine project path
  const projectPath =
    params.projectPath || process.env.PROJECT_HOST_PATH || process.cwd();

  if (isRunningRemotely) {
    // Running remotely - return command for local execution
    const command = params.transcriptFile
      ? `npx tsx scripts/parse-transcript.ts "${params.transcriptFile}"`
      : `npx tsx scripts/parse-transcript.ts --latest "${projectPath}"`;

    return {
      success: true,
      runLocally: true,
      reason: 'MCP server is running remotely via SSH. Transcript files are on your local machine.',
      command,
      projectPath,
      instructions: `Execute the command above using the Bash tool, then pass the JSON output to record_component_complete as the transcriptMetrics parameter.

Example:
1. Run: ${command}
2. Parse the JSON output
3. Call record_component_complete with transcriptMetrics: { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalTokens }`,
    };
  }

  // Running locally - parse transcript directly
  const transcriptDir = findTranscriptDirectory(projectPath);

  let transcriptPath: string | null;

  if (params.transcriptFile) {
    // Specific file requested
    transcriptPath = params.transcriptFile.startsWith('/')
      ? params.transcriptFile
      : path.join(transcriptDir, params.transcriptFile);
  } else {
    // Find most recent transcript
    transcriptPath = findLatestTranscript(transcriptDir);
  }

  if (!transcriptPath) {
    return {
      success: false,
      runLocally: false,
      error: `No transcript files found in ${transcriptDir}`,
      projectPath,
      transcriptDir,
    };
  }

  if (!fs.existsSync(transcriptPath)) {
    return {
      success: false,
      runLocally: false,
      error: `Transcript file not found: ${transcriptPath}`,
      projectPath,
      transcriptDir,
    };
  }

  try {
    const metrics = await parseTranscript(transcriptPath);

    if (!metrics) {
      return {
        success: false,
        runLocally: false,
        error: 'Failed to parse transcript (empty or invalid)',
        transcriptPath,
      };
    }

    return {
      success: true,
      runLocally: false,
      metrics,
      message: `Parsed transcript: ${metrics.totalTokens} total tokens (${metrics.inputTokens} in, ${metrics.outputTokens} out)`,
    };
  } catch (err) {
    return {
      success: false,
      runLocally: false,
      error: `Error parsing transcript: ${err}`,
      transcriptPath,
    };
  }
}
