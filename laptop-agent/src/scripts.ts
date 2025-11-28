import * as childProcess from 'child_process';
import * as path from 'path';

/**
 * Script Execution Module
 *
 * Executes approved scripts with whitelisted parameters.
 * Uses ts-node to run TypeScript scripts directly.
 */

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
  timeout: number = 30000,
): Promise<ScriptResult> {
  const scriptPath = path.join(projectPath, 'scripts', `${scriptName}.ts`);

  return new Promise((resolve) => {
    const args = [scriptPath, ...params];

    console.log(`Executing: ts-node ${args.join(' ')}`);

    const proc = childProcess.spawn('ts-node', args, {
      cwd: projectPath,
      timeout,
      env: {
        ...process.env,
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
        resolve({
          success: false,
          error: `Script exited with code ${code}`,
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
