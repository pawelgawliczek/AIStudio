/**
 * Agent Launcher Utility
 * Spawns Claude Code agents with OTEL telemetry configured
 */
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';

export interface AgentLaunchOptions {
  workflowRunId: string;
  componentRunId: string;
  projectId: string;
  prompt: string;
  workingDirectory: string;
  model?: string;
  maxTurns?: number;
  onOutput?: (data: string) => void;
  onError?: (error: Error) => void;
  onExit?: (code: number | null) => void;
}

export interface LaunchedAgent {
  process: ChildProcess;
  sessionId: string;
  startTime: Date;
}

/**
 * Launch a Claude Code agent with OTEL telemetry configured
 * Telemetry is sent to localhost:4317 (OTEL Collector)
 */
export function launchClaudeAgent(options: AgentLaunchOptions): LaunchedAgent {
  const sessionId = randomUUID();
  const startTime = new Date();

  // Build environment with OTEL configuration
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    // Enable Claude Code telemetry
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    // Point to local OTEL Collector
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
    // Inject workflow context as resource attributes
    OTEL_RESOURCE_ATTRIBUTES: [
      `workflow_run_id=${options.workflowRunId}`,
      `component_run_id=${options.componentRunId}`,
      `project_id=${options.projectId}`,
      `session_id=${sessionId}`,
    ].join(','),
    // Set service name for identification
    OTEL_SERVICE_NAME: 'vibestudio-agent',
  };

  // Build Claude Code command
  const args = [
    '--print',
    '--yes-always',
    options.prompt,
  ];

  if (options.model) {
    args.unshift('--model', options.model);
  }

  if (options.maxTurns) {
    args.unshift('--max-turns', options.maxTurns.toString());
  }

  // Spawn Claude Code process
  const childProcess = spawn('claude', args, {
    cwd: options.workingDirectory,
    env,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Handle stdout
  if (options.onOutput && childProcess.stdout) {
    childProcess.stdout.on('data', (data: Buffer) => {
      options.onOutput!(data.toString());
    });
  }

  // Handle stderr
  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data: Buffer) => {
      const errorText = data.toString();
      console.error(`[Agent ${sessionId}] stderr: ${errorText}`);
      if (options.onError) {
        options.onError(new Error(errorText));
      }
    });
  }

  // Handle exit
  childProcess.on('exit', (code) => {
    console.log(`[Agent ${sessionId}] exited with code ${code}`);
    if (options.onExit) {
      options.onExit(code);
    }
  });

  // Handle errors
  childProcess.on('error', (error) => {
    console.error(`[Agent ${sessionId}] process error:`, error);
    if (options.onError) {
      options.onError(error);
    }
  });

  return {
    process: childProcess,
    sessionId,
    startTime,
  };
}

/**
 * Example usage for testing
 */
export async function testAgentLaunch(): Promise<void> {
  const testOptions: AgentLaunchOptions = {
    workflowRunId: 'test-workflow-' + randomUUID(),
    componentRunId: 'test-component-' + randomUUID(),
    projectId: 'test-project-' + randomUUID(),
    prompt: 'echo "Hello from test agent"',
    workingDirectory: process.cwd(),
    onOutput: (data) => console.log('[OUTPUT]', data),
    onError: (error) => console.error('[ERROR]', error.message),
    onExit: (code) => console.log('[EXIT]', code),
  };

  const agent = launchClaudeAgent(testOptions);
  console.log(`Launched agent with session ID: ${agent.sessionId}`);
}
