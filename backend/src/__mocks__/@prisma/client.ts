/**
 * Global mock for @prisma/client
 *
 * This mock prevents Prisma engine initialization which causes 100% CPU loops
 * in Jest tests when the engine tries to spawn and communicate with itself.
 *
 * Tests that need real database access should use SKIP_PRISMA_MOCK=true
 * and be placed in *.integration.test.ts files.
 */

import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// DO NOT re-export from '@prisma/client/runtime/library' - it initializes the Prisma engine
// and causes 100% CPU infinite loops in Jest. Instead, mock the needed types inline.

// Enum exports - manually define common enums used in tests
export const RunStatus = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export const DeploymentStatus = {
  pending: 'pending',
  building: 'building',
  deploying: 'deploying',
  success: 'success',
  failed: 'failed',
  rolled_back: 'rolled_back',
} as const;

export const UserRole = {
  admin: 'admin',
  user: 'user',
  viewer: 'viewer',
} as const;

export const StoryType = {
  feature: 'feature',
  bug: 'bug',
  chore: 'chore',
  spike: 'spike',
} as const;

export const StoryStatus = {
  backlog: 'backlog',
  planning: 'planning',
  ready: 'ready',
  development: 'development',
  review: 'review',
  qa: 'qa',
  done: 'done',
} as const;

export const ComponentOnFailure = {
  stop: 'stop',
  continue: 'continue',
  retry: 'retry',
} as const;

export const DecisionStrategy = {
  sequential: 'sequential',
  parallel: 'parallel',
  conditional: 'conditional',
} as const;

export const ProjectStatus = {
  active: 'active',
  archived: 'archived',
  paused: 'paused',
} as const;

export const EpicStatus = {
  planning: 'planning',
  active: 'active',
  completed: 'completed',
  on_hold: 'on_hold',
} as const;

export const TestQueueStatus = {
  pending: 'pending',
  running: 'running',
  passed: 'passed',
  failed: 'failed',
  cancelled: 'cancelled',
  skipped: 'skipped',
} as const;

// Type definitions for mock
interface MockPrismaModel {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
  upsert: jest.Mock;
}

function createMockModel(): MockPrismaModel {
  return {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

// Create a mock PrismaClient class
export class PrismaClient {
  // Core models
  project = createMockModel();
  epic = createMockModel();
  story = createMockModel();
  useCase = createMockModel();
  testCase = createMockModel();
  testExecution = createMockModel();
  testQueue = createMockModel();

  // Component/Workflow models
  component = createMockModel();
  workflow = createMockModel();
  workflowRun = createMockModel();
  workflowState = createMockModel();
  componentRun = createMockModel();

  // Team models
  team = createMockModel();
  teamRun = createMockModel();
  agentRun = createMockModel();

  // Deployment models
  deploymentLog = createMockModel();
  deploymentApproval = createMockModel();
  worktree = createMockModel();

  // User/Auth models
  user = createMockModel();
  session = createMockModel();

  // Remote agent models
  remoteAgent = createMockModel();
  remoteJob = createMockModel();

  // Versioning models
  componentVersion = createMockModel();
  workflowVersion = createMockModel();

  // Artifact models
  artifact = createMockModel();

  // Queue/Lock models
  queueLock = createMockModel();

  // Analytics models
  snapshotTrendData = createMockModel();

  // File mapping models
  fileMapping = createMockModel();

  // Transaction support
  $transaction = jest.fn().mockImplementation(async (operations: any) => {
    if (typeof operations === 'function') {
      return operations(this);
    }
    return Promise.all(operations);
  });

  // Connection methods
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);

  // Raw query support
  $queryRaw = jest.fn().mockResolvedValue([]);
  $executeRaw = jest.fn().mockResolvedValue(0);
  $queryRawUnsafe = jest.fn().mockResolvedValue([]);
  $executeRawUnsafe = jest.fn().mockResolvedValue(0);

  // Metrics
  $metrics = {
    json: jest.fn().mockResolvedValue({}),
    prometheus: jest.fn().mockResolvedValue(''),
  };

  // Event handling
  $on = jest.fn();
  $use = jest.fn();

  // Extends support
  $extends = jest.fn().mockReturnThis();

  constructor(_options?: any) {
    // Constructor accepts options but doesn't do anything
  }
}

// Also export a pre-created mock instance for tests that want to use mockDeep
export const prismaMock = new PrismaClient() as unknown as DeepMockProxy<PrismaClient>;

// Export Prisma namespace for type access
export const Prisma = {
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    meta?: Record<string, unknown>;

    constructor(message: string, { code, clientVersion, meta }: { code: string; clientVersion: string; meta?: Record<string, unknown> }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = code;
      this.clientVersion = clientVersion;
      this.meta = meta;
    }
  },
  PrismaClientValidationError: class PrismaClientValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientValidationError';
    }
  },
  PrismaClientInitializationError: class PrismaClientInitializationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientInitializationError';
    }
  },
  PrismaClientRustPanicError: class PrismaClientRustPanicError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PrismaClientRustPanicError';
    }
  },
  // Common error codes
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  // SQL template tag mock
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    text: strings.join('?'),
  }),
  join: (values: unknown[], separator?: string) => ({
    values,
    separator: separator || ', ',
  }),
  raw: (value: string) => ({ value }),
  // JSON helpers
  JsonNull: Symbol('JsonNull'),
  AnyNull: Symbol('AnyNull'),
  DbNull: Symbol('DbNull'),
  // Sort order
  SortOrder: {
    asc: 'asc',
    desc: 'desc',
  },
  // Query mode
  QueryMode: {
    default: 'default',
    insensitive: 'insensitive',
  },
  // Transaction isolation levels
  TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable',
  },
};

// Default export for CommonJS compatibility
export default { PrismaClient, Prisma, prismaMock };
