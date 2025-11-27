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
- If MCP server runs in DOCKER: Returns { runLocally: true, command: "..." }

IMPORTANT: When runLocally=true, you MUST execute the command via Bash tool.
The Bash tool runs on the HOST machine (where Claude Code runs), so it CAN access transcripts.
The command uses the correct HOST path (PROJECT_HOST_PATH), not the Docker path.

Example flow:
1. Call get_transcript_metrics()
2. If runLocally=true: Execute the returned command via Bash tool
3. Parse the JSON output from Bash
4. Pass metrics to record_component_complete as transcriptMetrics parameter`,
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
      agentId: {
        type: 'string',
        description:
          'Agent ID to find agent transcript (agent-{id}.jsonl). Use "latest" to find most recent agent transcript.',
      },
      searchContent: {
        type: 'string',
        description:
          'Search for a transcript containing this content (e.g., runId, componentId, storyId). Useful when multiple agents are running in parallel.',
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
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
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

  let model = 'unknown';

  // Deduplicate by message ID - keep LAST occurrence (has final token counts after streaming)
  const messageUsageMap = new Map<string, MessageUsage>();

  for (const record of records) {
    if (record.message?.model) {
      model = record.message.model;
    }
    if (record.message?.usage) {
      const usage = record.message.usage;
      const messageId = record.message.id;

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

  // Use Array.from() for ES5 compatibility
  const usageEntries = Array.from(messageUsageMap.values());
  for (const usage of usageEntries) {
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
  const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');
  return path.join(os.homedir(), '.claude', 'projects', escapedPath);
}

function findLatestTranscript(transcriptDir: string): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const files = fs
    .readdirSync(transcriptDir)
    .filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'))
    .map((f) => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

function findLatestAgentTranscript(transcriptDir: string): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const files = fs
    .readdirSync(transcriptDir)
    .filter((f) => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .map((f) => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

function findAgentTranscript(transcriptDir: string, agentId: string): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const files = fs
    .readdirSync(transcriptDir)
    .filter((f) => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .filter((f) => {
      const fileAgentId = f.replace('agent-', '').replace('.jsonl', '');
      return fileAgentId === agentId || fileAgentId.startsWith(agentId);
    });

  if (files.length === 0) {
    return null;
  }

  if (files.length > 1) {
    const sorted = files
      .map((f) => ({
        name: f,
        path: path.join(transcriptDir, f),
        mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return sorted[0].path;
  }

  return path.join(transcriptDir, files[0]);
}

/**
 * Find a transcript file containing specific content (e.g., runId, componentId, storyId).
 * Useful when multiple agents are running in parallel to find the correct one.
 * Searches only recent agent transcripts (modified in last hour) for efficiency.
 */
function findTranscriptByContent(transcriptDir: string, searchContent: string): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  // Get recent agent transcripts (modified in last hour)
  const recentAgentFiles = fs
    .readdirSync(transcriptDir)
    .filter((f) => f.endsWith('.jsonl') && f.startsWith('agent-'))
    .map((f) => ({
      name: f,
      path: path.join(transcriptDir, f),
      mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
    }))
    .filter((f) => f.mtime.getTime() > oneHourAgo)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // newest first

  // Search each file for the content
  for (const file of recentAgentFiles) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      if (content.includes(searchContent)) {
        return file.path;
      }
    } catch {
      // Skip files we can't read
    }
  }

  return null;
}

export async function handler(_prisma: PrismaClient, params: any) {
  // Detect if running remotely via SSH or in Docker
  const isRunningRemotely = !!process.env.SSH_CONNECTION;
  const isRunningInDocker = !!process.env.DOCKER_CONTAINER || fs.existsSync('/.dockerenv');

  // Determine project path - use PROJECT_HOST_PATH which contains the LOCAL machine path
  // where Claude Code runs and stores transcripts
  // CRITICAL: This must be the HOST path (e.g., /Users/pawelgawliczek/projects/AIStudio)
  // NOT the Docker path (e.g., /app or /opt/stack/AIStudio)
  const projectPath = process.env.PROJECT_HOST_PATH || params.projectPath || process.cwd();

  if (isRunningRemotely || isRunningInDocker) {
    // MCP server is running in Docker, but the Bash tool runs on the HOST machine
    // So we return a command that the agent can execute via Bash to parse transcripts
    //
    // The command uses PROJECT_HOST_PATH which is the correct path on the host machine
    // where Claude Code runs and stores transcripts in ~/.claude/projects/

    let command: string;
    if (params.transcriptFile) {
      command = `cd "${projectPath}" && npx tsx scripts/parse-transcript.ts "${params.transcriptFile}"`;
    } else if (params.searchContent) {
      // Search for transcript containing specific content (runId, componentId, storyId)
      command = `cd "${projectPath}" && npx tsx scripts/parse-transcript.ts --search "${params.searchContent}" "${projectPath}"`;
    } else if (params.agentId === 'latest') {
      command = `cd "${projectPath}" && npx tsx scripts/parse-transcript.ts --latest-agent "${projectPath}"`;
    } else if (params.agentId) {
      command = `cd "${projectPath}" && npx tsx scripts/parse-transcript.ts --agent "${params.agentId}" "${projectPath}"`;
    } else {
      command = `cd "${projectPath}" && npx tsx scripts/parse-transcript.ts --latest "${projectPath}"`;
    }

    return {
      success: true,
      runLocally: true,
      reason: 'MCP server is running in Docker. Execute the command via Bash tool to parse transcripts on the host machine.',
      projectPath,
      transcriptDir: `~/.claude/projects/${projectPath.replace(/^\//, '-').replace(/\//g, '-')}/`,
      command,
      instructions: `Execute this command via Bash tool to get transcript metrics:

${command}

The Bash tool runs on the HOST machine where Claude Code runs, so it CAN access:
- The parse-transcript.ts script at ${projectPath}/scripts/
- The transcript files at ~/.claude/projects/${projectPath.replace(/^\//, '-').replace(/\//g, '-')}/

After running the command, parse the JSON output and pass it to record_component_complete:
{
  transcriptMetrics: {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cacheCreationTokens: result.cacheCreationTokens,
    cacheReadTokens: result.cacheReadTokens,
    totalTokens: result.totalTokens
  }
}`,
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
  } else if (params.searchContent) {
    // Search for transcript containing specific content (runId, componentId, storyId)
    transcriptPath = findTranscriptByContent(transcriptDir, params.searchContent);
  } else if (params.agentId === 'latest') {
    // Find most recent agent transcript
    transcriptPath = findLatestAgentTranscript(transcriptDir);
  } else if (params.agentId) {
    // Find specific agent transcript
    transcriptPath = findAgentTranscript(transcriptDir, params.agentId);
  } else {
    // Find most recent main session transcript
    transcriptPath = findLatestTranscript(transcriptDir);
  }

  if (!transcriptPath) {
    let errorMessage: string;
    let hint: string | undefined;

    if (params.searchContent) {
      errorMessage = `No agent transcript found containing "${params.searchContent}" in ${transcriptDir} (searched recent files from last hour)`;
      hint = 'Ensure the searchContent (runId, componentId, storyId) was included in the agent task';
    } else if (params.agentId) {
      errorMessage =
        params.agentId === 'latest'
          ? `No agent transcripts found in ${transcriptDir}. Agent transcripts are named agent-{uuid}.jsonl`
          : `No agent transcript found for ID ${params.agentId} in ${transcriptDir}`;
      hint = 'Use agentId: "latest" to find the most recent agent transcript';
    } else {
      errorMessage = `No transcript files found in ${transcriptDir}`;
    }

    return {
      success: false,
      runLocally: false,
      error: errorMessage,
      projectPath,
      transcriptDir,
      hint,
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
