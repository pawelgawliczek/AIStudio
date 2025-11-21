/**
 * Environment Configuration & Safety Guards (ST-76)
 *
 * Defines production vs test environment constants and provides
 * safety functions to prevent agents from touching production.
 */

// =============================================================================
// Environment Constants
// =============================================================================

export const PRODUCTION = {
  DB_PORT: 5432,
  DB_NAME: 'vibestudio',
  BACKEND_PORT: 3000,
  FRONTEND_PORT: 5173,
  REDIS_PORT: 6379,
  DB_HOST: '127.0.0.1',
  CONTAINERS: ['vibe-studio-backend', 'vibe-studio-frontend'],
  MAIN_WORKTREE: '/opt/stack/AIStudio',
} as const;

export const TEST = {
  DB_PORT: 5434,
  DB_NAME: 'vibestudio_test',
  BACKEND_PORT: 3001,
  FRONTEND_PORT: 5174,
  REDIS_PORT: 6381,
  DB_HOST: '127.0.0.1',
  CONTAINERS: ['vibe-studio-test-backend', 'vibe-studio-test-frontend'],
  COMPOSE_FILE: 'docker-compose.test.yml',
} as const;

// =============================================================================
// Safety Check Functions
// =============================================================================

/**
 * Check if a port is a production port
 */
export function isProductionPort(port: number): boolean {
  const productionPorts: number[] = [
    PRODUCTION.DB_PORT,
    PRODUCTION.BACKEND_PORT,
    PRODUCTION.FRONTEND_PORT,
    PRODUCTION.REDIS_PORT,
  ];
  return productionPorts.includes(port);
}

/**
 * Check if a container name is a production container
 */
export function isProductionContainer(name: string): boolean {
  // Production containers don't have 'test' in the name
  return PRODUCTION.CONTAINERS.some(
    (c) => name.includes(c) && !name.includes('test')
  );
}

/**
 * Check if a database URL points to production
 */
export function isProductionDatabaseUrl(dbUrl: string): boolean {
  try {
    // Handle postgresql:// URLs by converting to parseable format
    const urlString = dbUrl.replace('postgresql://', 'http://');
    const url = new URL(urlString);
    const port = parseInt(url.port || '5432', 10);
    const dbName = url.pathname.replace('/', '').split('?')[0];

    // Production if: port 5432 AND database name doesn't contain '_test'
    return port === PRODUCTION.DB_PORT && !dbName.includes('_test');
  } catch {
    // If we can't parse, assume production for safety
    console.warn(`Could not parse DATABASE_URL: ${dbUrl}. Assuming production.`);
    return true;
  }
}

// =============================================================================
// Safety Assertion Functions (throw on violation)
// =============================================================================

export class ProductionSafetyError extends Error {
  constructor(
    message: string,
    public operation: string,
    public suggestion: string
  ) {
    super(`🛑 PRODUCTION SAFETY BLOCK: ${message}`);
    this.name = 'ProductionSafetyError';
  }
}

/**
 * Assert that a database URL does NOT point to production
 * Throws ProductionSafetyError if production DB detected
 */
export function assertNotProductionDb(dbUrl: string, operation: string): void {
  if (isProductionDatabaseUrl(dbUrl)) {
    throw new ProductionSafetyError(
      `Attempted to ${operation} on PRODUCTION database (port ${PRODUCTION.DB_PORT})`,
      operation,
      `Use test database on port ${TEST.DB_PORT} with DATABASE_URL containing '${TEST.DB_NAME}'`
    );
  }
}

/**
 * Assert that we're not operating on production containers
 * Throws ProductionSafetyError if production container detected
 */
export function assertNotProductionContainer(
  containerName: string,
  operation: string
): void {
  if (isProductionContainer(containerName)) {
    throw new ProductionSafetyError(
      `Attempted to ${operation} production container '${containerName}'`,
      operation,
      `Use test containers: ${TEST.CONTAINERS.join(', ')}`
    );
  }
}

/**
 * Assert that we're not checking out a branch in main worktree
 * Throws ProductionSafetyError if main worktree checkout detected
 */
export function assertNotMainWorktreeCheckout(
  worktreePath: string,
  branch: string
): void {
  if (worktreePath === PRODUCTION.MAIN_WORKTREE && branch !== 'main') {
    throw new ProductionSafetyError(
      `Attempted to checkout branch '${branch}' in main worktree`,
      'git checkout',
      `Use dedicated worktree at /opt/stack/worktrees/<branch-name> instead`
    );
  }
}

/**
 * Assert that a port is a test port, not production
 */
export function assertTestPort(port: number, service: string): void {
  if (isProductionPort(port)) {
    throw new ProductionSafetyError(
      `Attempted to use production port ${port} for ${service}`,
      `connect to ${service}`,
      `Use test ports: DB=${TEST.DB_PORT}, Backend=${TEST.BACKEND_PORT}, Frontend=${TEST.FRONTEND_PORT}`
    );
  }
}

// =============================================================================
// Docker Command Safety
// =============================================================================

const BLOCKED_PRODUCTION_PATTERNS = [
  // Block restart/stop/down on production containers
  /\b(restart|stop|down|rm)\s+(backend|frontend)\b/i,
  // Block 'up -d backend' or 'up -d frontend' without test prefix
  /\bup\s+(-d\s+)?(backend|frontend)\b(?!.*test)/i,
  // Block build backend/frontend without test prefix
  /\bbuild\s+(--no-cache\s+)?(backend|frontend)\b(?!.*test)/i,
];

/**
 * Check if a docker compose command targets production
 */
export function isProductionDockerCommand(command: string): boolean {
  return BLOCKED_PRODUCTION_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Assert that a docker compose command doesn't target production
 */
export function assertSafeDockerCommand(command: string): void {
  if (isProductionDockerCommand(command)) {
    throw new ProductionSafetyError(
      `Docker command targets production containers: '${command}'`,
      'docker compose',
      `Use docker compose -f ${TEST.COMPOSE_FILE} with test-* services`
    );
  }
}

// =============================================================================
// Agent Mode Context
// =============================================================================

let agentTestingMode = false;

/**
 * Enable agent testing mode - activates all safety guards
 */
export function enableAgentTestingMode(): void {
  agentTestingMode = true;
  console.log('🔒 Agent testing mode ENABLED - production safety guards active');
}

/**
 * Disable agent testing mode
 */
export function disableAgentTestingMode(): void {
  agentTestingMode = false;
  console.log('🔓 Agent testing mode DISABLED');
}

/**
 * Check if agent testing mode is active
 */
export function isAgentTestingMode(): boolean {
  return agentTestingMode || process.env.AGENT_MODE === 'testing';
}

/**
 * Run a function with agent testing mode enabled
 */
export async function withAgentTestingMode<T>(
  fn: () => Promise<T>
): Promise<T> {
  enableAgentTestingMode();
  try {
    return await fn();
  } finally {
    disableAgentTestingMode();
  }
}
