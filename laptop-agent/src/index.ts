#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, saveConfig } from './config';
import { RemoteAgent } from './agent';
import { initializeLogger, shutdownLogger, Logger, getLogDir } from './logger';
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
      // Load configuration first
      const config = loadConfig();

      // Initialize logger with config
      initializeLogger({
        level: config.logLevel,
        lokiEnabled: config.lokiEnabled,
        lokiUrl: config.lokiUrl,
        lokiUsername: config.lokiUsername,
        lokiPassword: config.lokiPassword,
        lokiLabels: {
          project: 'vibestudio',
        },
      });

      const logger = new Logger('Main');

      logger.info('VibeStudio Remote Agent v1.0.0 starting');
      logger.info('Configuration loaded', {
        server: config.serverUrl,
        hostname: config.hostname,
        capabilities: config.capabilities,
        projectPath: config.projectPath,
        lokiEnabled: config.lokiEnabled,
        logDir: getLogDir(),
      });

      // Create and connect agent
      const agent = new RemoteAgent(config);
      await agent.connect();

      logger.info('Agent running. Press Ctrl+C to stop.');

      // Handle graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down agent...');
        agent.disconnect();
        await shutdownLogger();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
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
      console.log('\nLogging Configuration:');
      console.log(`  Log Level: ${config.logLevel}`);
      console.log(`  Local Logs: ${getLogDir()}`);
      console.log(`  Loki Enabled: ${config.lokiEnabled}`);
      console.log(`  Loki URL: ${config.lokiUrl}`);
      console.log('\nNote: Use "start" command to connect agent.');
    } catch (error: any) {
      console.error('Configuration error:', error.message);
      process.exit(1);
    }
  });

/**
 * Logs command - Show log location and recent logs
 */
program
  .command('logs')
  .description('Show log file location')
  .option('-f, --follow', 'Follow log output (like tail -f)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    const logDir = getLogDir();
    console.log(`Log directory: ${logDir}`);
    console.log('\nLog files:');

    const fs = await import('fs');
    const path = await import('path');

    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir).filter((f: string) => f.endsWith('.log'));
      files.sort().reverse().forEach((f: string) => {
        const filePath = path.join(logDir, f);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(1);
        console.log(`  ${f} (${size} KB)`);
      });

      if (files.length > 0 && !options.follow) {
        const latestLog = path.join(logDir, files[0]);
        console.log(`\nLatest log (${files[0]}):`);
        console.log('─'.repeat(60));
        const { execSync } = await import('child_process');
        try {
          const output = execSync(`tail -n ${options.lines} "${latestLog}"`, { encoding: 'utf-8' });
          console.log(output);
        } catch {
          console.log('(unable to read log file)');
        }
      } else if (options.follow && files.length > 0) {
        const latestLog = path.join(logDir, files[0]);
        console.log(`\nFollowing ${files[0]} (Ctrl+C to stop):`);
        console.log('─'.repeat(60));
        const { spawn } = await import('child_process');
        const tail = spawn('tail', ['-f', latestLog], { stdio: 'inherit' });
        process.on('SIGINT', () => {
          tail.kill();
          process.exit(0);
        });
      }
    } else {
      console.log('  (no logs yet - start the agent first)');
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
