#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, saveConfig } from './config';
import { RemoteAgent } from './agent';
import * as dotenv from 'dotenv';

// Load .env file if present
dotenv.config();

const program = new Command();

program
  .name('vibestudio-agent')
  .description('VibeStudio Remote Execution Agent')
  .version('1.0.0');

/**
 * Start command - Connect agent to server
 */
program
  .command('start')
  .description('Start the remote agent and connect to server')
  .action(async () => {
    try {
      console.log('VibeStudio Remote Agent v1.0.0');
      console.log('================================\n');

      // Load configuration
      const config = loadConfig();
      console.log(`Server: ${config.serverUrl}`);
      console.log(`Hostname: ${config.hostname}`);
      console.log(`Capabilities: ${config.capabilities.join(', ')}`);
      console.log(`Project Path: ${config.projectPath}\n`);

      // Create and connect agent
      const agent = new RemoteAgent(config);
      await agent.connect();

      console.log('\nAgent running. Press Ctrl+C to stop.\n');

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\nShutting down agent...');
        agent.disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        console.log('\nShutting down agent...');
        agent.disconnect();
        process.exit(0);
      });
    } catch (error: any) {
      console.error('Failed to start agent:', error.message);
      process.exit(1);
    }
  });

/**
 * Status command - Check agent status
 */
program
  .command('status')
  .description('Check agent connection status')
  .action(async () => {
    try {
      const config = loadConfig();
      console.log('Agent Configuration:');
      console.log(`  Server: ${config.serverUrl}`);
      console.log(`  Hostname: ${config.hostname}`);
      console.log(`  Capabilities: ${config.capabilities.join(', ')}`);
      console.log(`  Project Path: ${config.projectPath}`);
      console.log('\nNote: Use "start" command to connect agent.');
    } catch (error: any) {
      console.error('Configuration error:', error.message);
      process.exit(1);
    }
  });

/**
 * Stop command - Placeholder (actual stop requires process management)
 */
program
  .command('stop')
  .description('Stop the running agent')
  .action(() => {
    console.log('To stop the agent, use Ctrl+C in the terminal where it is running.');
    console.log('For background processes, use process management tools like pm2 or systemd.');
  });

/**
 * Configure command - Interactive configuration
 */
program
  .command('configure')
  .description('Configure agent settings')
  .option('--server-url <url>', 'Server URL')
  .option('--secret <secret>', 'Agent secret')
  .option('--hostname <hostname>', 'Agent hostname')
  .option('--project-path <path>', 'Project path')
  .action((options) => {
    try {
      const config = loadConfig();

      if (options.serverUrl) {
        config.serverUrl = options.serverUrl;
      }
      if (options.secret) {
        config.agentSecret = options.secret;
      }
      if (options.hostname) {
        config.hostname = options.hostname;
      }
      if (options.projectPath) {
        config.projectPath = options.projectPath;
      }

      saveConfig(config);
      console.log('Configuration saved to ~/.vibestudio/config.json');
    } catch (error: any) {
      console.error('Configuration error:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
