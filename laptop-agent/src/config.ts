import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Agent Configuration
 *
 * Loads configuration from:
 * 1. ~/.vibestudio/config.json (preferred)
 * 2. Environment variables
 * 3. Default values
 */

export interface AgentConfig {
  serverUrl: string;
  agentSecret: string;
  hostname: string;
  capabilities: string[];
  projectPath: string;
  logLevel: string;
  // Centralized logging configuration
  lokiEnabled: boolean;
  lokiUrl: string;
  lokiUsername: string;
  lokiPassword: string;
  // Queue configuration (ST-346)
  maxQueueSize: number;
  // ST-334: Health endpoint configuration
  healthPort: number;
}

const DEFAULT_CONFIG: Partial<AgentConfig> = {
  serverUrl: 'http://127.0.0.1:3001',
  hostname: os.hostname(),
  capabilities: [
    'parse-transcript',
    'analyze-story-transcripts',
    'list-transcripts',
    'exec-command',       // ST-269: Code impact metrics (git diff)
    'read-file',          // ST-173: Transcript reading
    'workflow-tracker',   // ST-164: Context recovery
    'artifact-move',      // ST-363: Artifact directory moving for epic assignment
  ],
  logLevel: 'info',
  // Centralized logging defaults
  lokiEnabled: true,
  lokiUrl: 'https://vibestudio.example.com/loki',
  lokiUsername: 'vibestudio',
  lokiPassword: 'a0b961abd748e5ebe29fb074ab9f498e69ddf87028d33855',
  // Queue configuration (ST-346)
  maxQueueSize: 20000,
  // ST-334: Health endpoint configuration
  healthPort: 3002,
};

/**
 * Load configuration from ~/.vibestudio/config.json
 */
function loadConfigFile(): Partial<AgentConfig> {
  const configPath = path.join(os.homedir(), '.vibestudio', 'config.json');

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.warn(`Failed to load config file: ${error instanceof Error ? error.message : error}`);
  }

  return {};
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<AgentConfig> {
  const config: Partial<AgentConfig> = {};

  if (process.env.SERVER_URL) {
    config.serverUrl = process.env.SERVER_URL;
  }

  if (process.env.AGENT_SECRET) {
    config.agentSecret = process.env.AGENT_SECRET;
  }

  if (process.env.AGENT_HOSTNAME) {
    config.hostname = process.env.AGENT_HOSTNAME;
  }

  if (process.env.AGENT_CAPABILITIES) {
    config.capabilities = process.env.AGENT_CAPABILITIES.split(',').map((c) => c.trim());
  }

  if (process.env.PROJECT_PATH) {
    config.projectPath = process.env.PROJECT_PATH;
  }

  if (process.env.LOG_LEVEL) {
    config.logLevel = process.env.LOG_LEVEL;
  }

  if (process.env.LOKI_ENABLED !== undefined) {
    config.lokiEnabled = process.env.LOKI_ENABLED === 'true';
  }

  if (process.env.LOKI_URL) {
    config.lokiUrl = process.env.LOKI_URL;
  }

  if (process.env.LOKI_USERNAME) {
    config.lokiUsername = process.env.LOKI_USERNAME;
  }

  if (process.env.LOKI_PASSWORD) {
    config.lokiPassword = process.env.LOKI_PASSWORD;
  }

  // Queue configuration (ST-346)
  if (process.env.MAX_QUEUE_SIZE) {
    const parsed = parseInt(process.env.MAX_QUEUE_SIZE, 10);
    if (!isNaN(parsed) && parsed > 0) {
      config.maxQueueSize = parsed;
    }
  }

  // ST-334: Health endpoint configuration
  if (process.env.HEALTH_PORT) {
    const parsed = parseInt(process.env.HEALTH_PORT, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      config.healthPort = parsed;
    }
  }

  return config;
}

/**
 * Load merged configuration from all sources
 * Priority: ENV > File > Defaults
 */
export function loadConfig(): AgentConfig {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvConfig();

  const config = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
  } as AgentConfig;

  // Validate required fields
  if (!config.agentSecret) {
    throw new Error(
      'AGENT_SECRET is required. Set it in ~/.vibestudio/config.json or AGENT_SECRET env var'
    );
  }

  if (!config.projectPath) {
    throw new Error(
      'PROJECT_PATH is required. Set it in ~/.vibestudio/config.json or PROJECT_PATH env var'
    );
  }

  return config;
}

/**
 * Save configuration to ~/.vibestudio/config.json
 */
export function saveConfig(config: AgentConfig): void {
  const configDir = path.join(os.homedir(), '.vibestudio');
  const configPath = path.join(configDir, 'config.json');

  // Create directory if needed
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
