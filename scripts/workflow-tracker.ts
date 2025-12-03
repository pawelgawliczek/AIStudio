#!/usr/bin/env npx tsx
/**
 * ST-164: Workflow Tracker Script Wrapper
 *
 * Wrapper that calls the actual workflow-tracker.sh script.
 * Required because laptop-agent expects scripts in scripts/ directory as .ts files.
 */

import { execSync } from 'child_process';
import * as path from 'path';

const projectPath = path.resolve(__dirname, '..');
const scriptPath = path.join(projectPath, '.claude', 'hooks', 'workflow-tracker.sh');

// Get args (skip node and script path)
const args = process.argv.slice(2);

try {
  const result = execSync(`"${scriptPath}" ${args.join(' ')}`, {
    cwd: projectPath,
    encoding: 'utf-8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectPath,
    },
  });

  console.log(result);
  process.exit(0);
} catch (error: any) {
  console.error(error.stderr || error.message);
  process.exit(error.status || 1);
}
