#!/usr/bin/env node
/**
 * Story Runner Entry Point
 * CLI interface for starting and resuming workflow runs
 */

import { Command } from 'commander';
import { config as loadDotenv } from 'dotenv';
import { Runner } from './runner';
import { loadConfig } from './types';

// Load environment variables
loadDotenv();

const program = new Command();

program
  .name('story-runner')
  .description('Story Runner - Orchestrates workflow execution using Claude Code CLI sessions')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new workflow run')
  .requiredOption('-r, --run-id <id>', 'Workflow run ID')
  .requiredOption('-w, --workflow-id <id>', 'Workflow ID')
  .option('-s, --story-id <id>', 'Story ID (optional)')
  .option('-t, --triggered-by <user>', 'User or agent that triggered the run', 'cli')
  .action(async (options) => {
    console.log('='.repeat(60));
    console.log('Story Runner - Starting new run');
    console.log('='.repeat(60));
    console.log(`Run ID: ${options.runId}`);
    console.log(`Workflow ID: ${options.workflowId}`);
    if (options.storyId) {
      console.log(`Story ID: ${options.storyId}`);
    }
    console.log(`Triggered by: ${options.triggeredBy}`);
    console.log('='.repeat(60));

    try {
      const config = loadConfig();
      const runner = new Runner(config);

      // Set up event listeners
      setupEventListeners(runner);

      // Start the run
      await runner.start({
        runId: options.runId,
        workflowId: options.workflowId,
        storyId: options.storyId,
        triggeredBy: options.triggeredBy,
      });

      console.log('\n' + '='.repeat(60));
      console.log('Story Runner - Completed');
      console.log('='.repeat(60));
      process.exit(0);
    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('Story Runner - Failed');
      console.error('='.repeat(60));
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume a paused or crashed workflow run')
  .requiredOption('-r, --run-id <id>', 'Workflow run ID to resume')
  .action(async (options) => {
    console.log('='.repeat(60));
    console.log('Story Runner - Resuming run');
    console.log('='.repeat(60));
    console.log(`Run ID: ${options.runId}`);
    console.log('='.repeat(60));

    try {
      const config = loadConfig();
      const runner = new Runner(config);

      // Set up event listeners
      setupEventListeners(runner);

      // Resume the run
      await runner.resume(options.runId);

      console.log('\n' + '='.repeat(60));
      console.log('Story Runner - Completed');
      console.log('='.repeat(60));
      process.exit(0);
    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('Story Runner - Failed');
      console.error('='.repeat(60));
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Set up event listeners for the runner
 */
function setupEventListeners(runner: Runner): void {
  runner.on('state:changed', (state, previousState) => {
    console.log(`[Event] Runner state: ${previousState} → ${state}`);
  });

  runner.on('state:executing', (stateId, stateName) => {
    console.log(`[Event] Executing state: ${stateName}`);
  });

  runner.on('state:completed', (result) => {
    const status = result.success ? '✓' : result.skipped ? '○' : '✗';
    console.log(`[Event] State completed: ${status} (${result.durationMs}ms, ${result.tokensUsed} tokens)`);
  });

  runner.on('master:response', (response) => {
    console.log(`[Event] Master response: ${response.action} - ${response.message}`);
  });

  runner.on('agent:spawned', (stateId, componentId) => {
    console.log(`[Event] Agent spawned for component: ${componentId}`);
  });

  runner.on('agent:completed', (stateId, exitCode) => {
    console.log(`[Event] Agent completed with exit code: ${exitCode}`);
  });

  runner.on('checkpoint:saved', (checkpoint) => {
    console.log(`[Event] Checkpoint saved at state: ${checkpoint.currentStateId}`);
  });

  runner.on('error', (error) => {
    console.error(`[Event] Error: ${error.message}`);
  });

  // Handle process signals
  process.on('SIGINT', async () => {
    console.log('\n[Signal] Received SIGINT, pausing runner...');
    await runner.pause('SIGINT received');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Signal] Received SIGTERM, pausing runner...');
    await runner.pause('SIGTERM received');
    process.exit(0);
  });
}

// Parse command line arguments
program.parse(process.argv);
