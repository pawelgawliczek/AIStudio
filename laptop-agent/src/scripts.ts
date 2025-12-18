import * as childProcess from 'child_process';
import * as os from 'os';
import * as path from 'path';

/**
 * Script Execution Module
 *
 * Executes approved scripts with whitelisted parameters.
 * Uses ts-node to run TypeScript scripts directly.
 */

/**
 * Shell-escape an argument for safe use in shell commands.
 * Wraps arguments containing spaces or special characters in single quotes.
 */
function shellEscape(arg: string): string {
  // If arg contains spaces or shell special characters, wrap in single quotes
  // and escape any single quotes within
  if (/[\s'"\\\$`!&|;<>(){}[\]*?~]/.test(arg)) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}

export interface ScriptResult {
  success: boolean;
  result?: any;
  error?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Execute a script with parameters
 *
 * @param projectPath - Absolute path to project root
 * @param scriptName - Script name (e.g., 'parse-transcript')
 * @param params - Script parameters (e.g., ['--latest', '--agent=abc'])
 * @param timeout - Max execution time in milliseconds
 */
export async function executeScript(
  projectPath: string,
  scriptName: string,
  params: string[],
  timeout: number = 60000,
): Promise<ScriptResult> {
  const scriptPath = path.join(projectPath, 'scripts', `${scriptName}.ts`);

  return new Promise((resolve) => {
    const args = [scriptPath, ...params];

    // Build shell command with properly escaped arguments
    // This ensures arguments with spaces (like --command=git rev-parse HEAD) are preserved
    const escapedArgs = args.map(shellEscape);
    const shellCommand = `npx tsx ${escapedArgs.join(' ')}`;

    const startTime = Date.now();
    console.log(`[scripts] Executing: ${shellCommand}`);

    const proc = childProcess.spawn(shellCommand, [], {
      cwd: projectPath,
      timeout,
      shell: true, // Use shell to resolve npx in PATH
      env: {
        ...process.env,
        // Add nvm node path for launchd context (use os.homedir() for reliability in daemon context)
        HOME: os.homedir(),
        PATH: `${os.homedir()}/.nvm/versions/node/v20.17.0/bin:${process.env.PATH || '/usr/bin:/bin'}`,
        // Ensure we can access project dependencies
        NODE_PATH: path.join(projectPath, 'node_modules'),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      console.log(`[scripts] Process exited with code ${code} after ${elapsed}ms`);
      if (code === 0) {
        // Try to parse stdout as JSON
        try {
          const result = JSON.parse(stdout);
          resolve({
            success: true,
            result,
            stdout,
            stderr,
          });
        } catch {
          // Not JSON - return raw output
          resolve({
            success: true,
            result: { output: stdout },
            stdout,
            stderr,
          });
        }
      } else {
        console.error(`[scripts] Script failed with code ${code}. stderr: ${stderr.substring(0, 500)}`);
        resolve({
          success: false,
          error: `Script exited with code ${code}: ${stderr.substring(0, 200)}`,
          stdout,
          stderr,
        });
      }
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        stdout,
        stderr,
      });
    });

    // Handle timeout
    setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        error: 'Script execution timeout',
        stdout,
        stderr,
      });
    }, timeout);
  });
}
