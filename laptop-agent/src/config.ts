import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
}

const DEFAULT_CONFIG: Partial<AgentConfig> = {
  serverUrl: 'http://127.0.0.1:3001',
  hostname: os.hostname(),
  capabilities: ['parse-transcript', 'analyze-story-transcripts', 'list-transcripts'],
  logLevel: 'info',
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
    console.warn(`Failed to load config file: ${error.message}`);
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
