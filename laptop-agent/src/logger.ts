/**
 * Enhanced logger for laptop-agent
 *
 * Features:
 * - Console output for development
 * - Local file logging with rotation (~/.aistudio/logs/)
 * - Remote Loki shipping for centralized investigation
 */

import * as winston from 'winston';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import LokiTransport from 'winston-loki';

export interface LoggerConfig {
  level: string;
  lokiEnabled: boolean;
  lokiUrl: string;
  lokiUsername?: string;
  lokiPassword?: string;
  lokiLabels?: Record<string, string>;
  agentId?: string;
}

const DEFAULT_LOKI_URL = 'https://vibestudio.example.com/loki';
const LOG_DIR = path.join(os.homedir(), '.aistudio', 'logs');

// Ensure log directory exists
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const ctx = context ? `[${context}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${ctx} ${level}: ${message}${metaStr}`;
  })
);

// Format for file output (no colors, JSON for parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

let winstonLogger: winston.Logger | null = null;
let currentConfig: LoggerConfig | null = null;

/**
 * Initialize the global Winston logger
 */
export function initializeLogger(config: LoggerConfig): winston.Logger {
  ensureLogDir();

  const transports: winston.transport[] = [];

  // Console transport (always enabled)
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: config.level,
    })
  );

  // File transport with daily rotation
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'laptop-agent-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d', // Keep 14 days of logs
      format: fileFormat,
      level: config.level,
    })
  );

  // Error-only file for quick investigation
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'laptop-agent-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d', // Keep errors longer
      format: fileFormat,
      level: 'error',
    })
  );

  // Loki transport for centralized logging (if enabled)
  if (config.lokiEnabled && config.lokiUrl) {
    const lokiLabels: Record<string, string> = {
      app: 'laptop-agent',
      hostname: os.hostname(),
      ...config.lokiLabels,
    };

    if (config.agentId) {
      lokiLabels.agent_id = config.agentId;
    }

    const lokiOptions: any = {
      host: config.lokiUrl,
      labels: lokiLabels,
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err: Error) => {
        // Log locally but don't crash if Loki is unavailable
        console.warn('[Logger] Loki connection error:', err.message);
      },
      gracefulShutdown: true,
      clearOnError: true, // Don't accumulate failed batches
      batching: true,
      interval: 5, // Send logs every 5 seconds
    };

    // Add basic auth if credentials provided
    if (config.lokiUsername && config.lokiPassword) {
      lokiOptions.basicAuth = {
        username: config.lokiUsername,
        password: config.lokiPassword,
      };
    }

    transports.push(new LokiTransport(lokiOptions));
  }

  winstonLogger = winston.createLogger({
    level: config.level,
    defaultMeta: {},
    transports,
  });

  currentConfig = config;

  winstonLogger.info('Logger initialized', {
    context: 'Logger',
    logDir: LOG_DIR,
    lokiEnabled: config.lokiEnabled,
    lokiUrl: config.lokiEnabled ? config.lokiUrl : 'disabled',
  });

  return winstonLogger;
}

/**
 * Get the global logger instance
 */
function getLogger(): winston.Logger {
  if (!winstonLogger) {
    // Initialize with defaults if not yet initialized
    return initializeLogger({
      level: 'info',
      lokiEnabled: false,
      lokiUrl: DEFAULT_LOKI_URL,
    });
  }
  return winstonLogger;
}

/**
 * Logger class with context support (backwards compatible API)
 */
export class Logger {
  constructor(private context: string) {}

  info(message: string, meta?: Record<string, any>): void {
    getLogger().info(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, any>): void {
    getLogger().debug(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, any>): void {
    getLogger().warn(message, { context: this.context, ...meta });
  }

  error(message: string, meta?: Record<string, any>): void {
    getLogger().error(message, { context: this.context, ...meta });
  }
}

/**
 * Gracefully shutdown the logger (flush pending Loki batches)
 */
export async function shutdownLogger(): Promise<void> {
  if (winstonLogger) {
    // Close all transports
    await new Promise<void>((resolve) => {
      winstonLogger!.on('finish', resolve);
      winstonLogger!.end();
    });
  }
}

/**
 * Get the log directory path
 */
export function getLogDir(): string {
  return LOG_DIR;
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig | null {
  return currentConfig;
}
