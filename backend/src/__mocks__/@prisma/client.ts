/**
 * Global mock for @prisma/client
 *
 * This mock prevents Prisma engine initialization which causes 100% CPU loops
 * in Jest tests when the engine tries to spawn and communicate with itself.
 *
 * Tests that need real database access should use SKIP_PRISMA_MOCK=true
 * and be placed in *.integration.test.ts files.
 */

// DO NOT import from '@prisma/client/runtime/library' or jest-mock-extended here
// as it could trigger side effects. This file must be completely self-contained.

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
  analysis: 'analysis',
  architecture: 'architecture',
  design: 'design',
  implementation: 'implementation',
  review: 'review',
  qa: 'qa',
  done: 'done',
  blocked: 'blocked',
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

export const MappingSource = {
  COMMIT_DERIVED: 'COMMIT_DERIVED',
  MANUAL: 'MANUAL',
  AI_INFERRED: 'AI_INFERRED',
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

// Singleton instance for consistent mock behavior across all PrismaClient instantiations
// This ensures that when handlers create `new PrismaClient()`, they get the same mock
// that tests can configure via `prismaMock`
let _singletonInstance: PrismaClient | null = null;

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
  subtask = createMockModel();
  defect = createMockModel();
  defectNew = createMockModel();

  // Component/Workflow models
  component = createMockModel();
  workflow = createMockModel();
  workflowRun = createMockModel();
  workflowState = createMockModel();
  componentRun = createMockModel();
  activeWorkflow = createMockModel();

  // Agent models
  agent = createMockModel();
  agentFramework = createMockModel();
  agentQuestion = createMockModel();
  agentStreamEvent = createMockModel();

  // Run models
  run = createMockModel();
  runnerBreakpoint = createMockModel();

  // Worktree model
  worktree = createMockModel();

  // User/Auth models
  user = createMockModel();
  apiKey = createMockModel();

  // Remote agent models
  remoteAgent = createMockModel();
  remoteJob = createMockModel();

  // Versioning models
  componentVersion = createMockModel();
  workflowVersion = createMockModel();
  useCaseVersion = createMockModel();

  // Artifact models
  artifact = createMockModel();
  artifactDefinition = createMockModel();
  artifactVersion = createMockModel();
  artifactAccess = createMockModel();

  // Queue/Lock models
  testQueueLock = createMockModel();

  // Analytics/Metrics models
  codeMetrics = createMockModel();
  codeMetricsSnapshot = createMockModel();
  metricsAggregation = createMockModel();
  otelEvent = createMockModel();

  // Commit/PR models
  commit = createMockModel();
  commitFile = createMockModel();
  pullRequest = createMockModel();

  // Release models
  release = createMockModel();
  releaseItem = createMockModel();

  // Link models
  storyUseCaseLink = createMockModel();
  fileUseCaseLink = createMockModel();

  // Transcript models
  transcript = createMockModel();
  unassignedTranscript = createMockModel();

  // Approval models
  approvalRequest = createMockModel();

  // Audit/Monitoring models
  auditLog = createMockModel();
  diskUsageAlert = createMockModel();
  diskUsageReport = createMockModel();

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
    // Return singleton instance to ensure all `new PrismaClient()` calls
    // in handlers use the same mock that tests configure
    if (_singletonInstance) {
      return _singletonInstance;
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    _singletonInstance = this;
  }
}

// Export a pre-created mock instance for tests
// This will be the same instance returned by all `new PrismaClient()` calls
export const prismaMock = new PrismaClient();

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

/**
 * Reset all mock functions on the prismaMock instance to their default state.
 * Call this in beforeEach to ensure clean test state.
 * Note: Does not reset the singleton - all PrismaClient instances still share the same mock.
 */
export function resetAllMocks(): void {
  const models = [
    // Core models
    prismaMock.project,
    prismaMock.epic,
    prismaMock.story,
    prismaMock.useCase,
    prismaMock.testCase,
    prismaMock.testExecution,
    prismaMock.testQueue,
    prismaMock.subtask,
    prismaMock.defect,
    prismaMock.defectNew,
    // Component/Workflow models
    prismaMock.component,
    prismaMock.workflow,
    prismaMock.workflowRun,
    prismaMock.workflowState,
    prismaMock.componentRun,
    prismaMock.activeWorkflow,
    // Agent models
    prismaMock.agent,
    prismaMock.agentFramework,
    prismaMock.agentQuestion,
    prismaMock.agentStreamEvent,
    // Run models
    prismaMock.run,
    prismaMock.runnerBreakpoint,
    // Worktree model
    prismaMock.worktree,
    // User/Auth models
    prismaMock.user,
    prismaMock.apiKey,
    // Remote agent models
    prismaMock.remoteAgent,
    prismaMock.remoteJob,
    // Versioning models
    prismaMock.componentVersion,
    prismaMock.workflowVersion,
    prismaMock.useCaseVersion,
    // Artifact models
    prismaMock.artifact,
    prismaMock.artifactDefinition,
    prismaMock.artifactVersion,
    prismaMock.artifactAccess,
    // Queue/Lock models
    prismaMock.testQueueLock,
    // Analytics/Metrics models
    prismaMock.codeMetrics,
    prismaMock.codeMetricsSnapshot,
    prismaMock.metricsAggregation,
    prismaMock.otelEvent,
    // Commit/PR models
    prismaMock.commit,
    prismaMock.commitFile,
    prismaMock.pullRequest,
    // Release models
    prismaMock.release,
    prismaMock.releaseItem,
    // Link models
    prismaMock.storyUseCaseLink,
    prismaMock.fileUseCaseLink,
    // Transcript models
    prismaMock.transcript,
    prismaMock.unassignedTranscript,
    // Approval models
    prismaMock.approvalRequest,
    // Audit/Monitoring models
    prismaMock.auditLog,
    prismaMock.diskUsageAlert,
    prismaMock.diskUsageReport,
  ];

  models.forEach((model) => {
    Object.keys(model).forEach((method) => {
      const fn = (model as any)[method];
      if (typeof fn?.mockReset === 'function') {
        fn.mockReset();
        // Restore sensible defaults
        if (method === 'findUnique' || method === 'findFirst') {
          fn.mockResolvedValue(null);
        } else if (method === 'findMany') {
          fn.mockResolvedValue([]);
        } else if (method === 'count') {
          fn.mockResolvedValue(0);
        } else if (['create', 'update', 'upsert', 'delete'].includes(method)) {
          fn.mockResolvedValue({});
        } else if (['createMany', 'updateMany', 'deleteMany'].includes(method)) {
          fn.mockResolvedValue({ count: 0 });
        } else if (method === 'aggregate' || method === 'groupBy') {
          fn.mockResolvedValue(method === 'groupBy' ? [] : {});
        }
      }
    });
  });

  // Reset transaction mock
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(async (operations: any) => {
    if (typeof operations === 'function') {
      return operations(prismaMock);
    }
    return Promise.all(operations);
  });

  // Reset connection mocks
  prismaMock.$connect.mockReset();
  prismaMock.$connect.mockResolvedValue(undefined);
  prismaMock.$disconnect.mockReset();
  prismaMock.$disconnect.mockResolvedValue(undefined);

  // Reset raw query mocks
  prismaMock.$queryRaw.mockReset();
  prismaMock.$queryRaw.mockResolvedValue([]);
  prismaMock.$executeRaw.mockReset();
  prismaMock.$executeRaw.mockResolvedValue(0);
  prismaMock.$queryRawUnsafe.mockReset();
  prismaMock.$queryRawUnsafe.mockResolvedValue([]);
  prismaMock.$executeRawUnsafe.mockReset();
  prismaMock.$executeRawUnsafe.mockResolvedValue(0);
}

// Default export for CommonJS compatibility
export default { PrismaClient, Prisma, prismaMock, resetAllMocks };
