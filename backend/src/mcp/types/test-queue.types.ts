/**
 * Test Queue Management Type Definitions
 */

export interface TestQueueAddParams {
  storyId: string;                // Story UUID (required)
  priority?: number;              // 0-10 scale, default: 5
  submittedBy?: string;           // User/agent ID, default: 'mcp-user'
}

export interface TestQueueAddResponse {
  id: string;                     // Queue entry UUID
  storyId: string;
  storyKey: string;               // For human-readable output
  position: number;               // Absolute position (100, 200, etc.)
  priority: number;
  queuePosition: number;          // Ordinal position (1st, 2nd, 3rd)
  estimatedWaitMinutes: number;   // Based on entries ahead × 5 min
  totalInQueue: number;           // Total pending entries
  status: string;                 // Always 'pending' on add
  message: string;                // Success message
}

export interface TestQueueListParams {
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
  limit?: number;                 // Max results, default: 20, max: 100
  offset?: number;                // Pagination offset, default: 0
}

export interface TestQueueEntryResponse {
  id: string;
  storyId: string;
  storyKey?: string;              // Included via join
  storyTitle?: string;            // Included via join
  position: number;
  priority: number;
  status: string;
  submittedBy: string;
  testResults?: any;              // JSONB, only if status = passed/failed
  errorMessage?: string;          // Only if status = failed
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}

export interface TestQueueListResponse {
  entries: TestQueueEntryResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface TestQueueGetPositionParams {
  storyId: string;
}

export interface TestQueuePositionResponse {
  id: string;
  storyId: string;
  storyKey: string;
  position: number;               // Absolute position
  queuePosition: number;          // Ordinal position in queue
  priority: number;
  estimatedWaitMinutes: number;
  totalInQueue: number;
  status: string;
}

export interface TestQueueGetStatusParams {
  storyId: string;
}

export interface TestQueueStatusResponse {
  id: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  position: number;
  priority: number;
  status: string;
  submittedBy: string;
  testResults?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  queuePosition?: number;         // Only if status = pending
  estimatedWaitMinutes?: number;  // Only if status = pending
}

export interface TestQueueRemoveParams {
  storyId: string;
}

export interface TestQueueRemoveResponse {
  id: string;
  storyId: string;
  storyKey: string;
  previousStatus: string;
  message: string;
}

export interface RunTestsParams {
  storyId: string;                            // Required: Story UUID
  testType?: 'unit' | 'integration' | 'e2e' | 'all'; // Optional, default: 'all'
}

export interface RunTestsResponse {
  success: boolean;                           // Overall success/failure
  storyId: string;
  storyKey: string;                           // e.g., "ST-45"
  testType: string;                           // Type executed
  testResults: TestResults;                   // Detailed results
  failureReasons?: string[];                  // Only if failed
  warnings?: string[];                        // Migration rollback warnings, etc.
  message: string;                            // Human-readable summary
}

export interface TestResults {
  testType: 'unit' | 'integration' | 'e2e' | 'all';
  success: boolean;                           // Final outcome
  exitCode: number;                           // Last attempt's exit code
  totalTests: number;                         // Total test count
  passedTests: number;                        // Passed count
  failedTests: number;                        // Failed count
  skippedTests?: number;                      // Skipped count
  duration: number;                           // Total duration in milliseconds
  timestamp: string;                          // ISO 8601 completion time
  attempts: TestAttempt[];                    // Array of 1-3 attempts
  migrationInfo?: MigrationInfo;              // Only if breaking migration + failure
  output?: string;                            // Captured stdout/stderr (last 1000 lines)
}

export interface TestAttempt {
  attempt: number;                            // 1-3
  result: 'passed' | 'failed' | 'timeout';
  exitCode: number;
  duration: number;                           // Milliseconds
  timestamp: string;                          // ISO 8601
  failedTests?: string[];                     // Names of failed tests
  output?: string;                            // Stdout/stderr for this attempt
  errorMessage?: string;                      // Error summary
}

export interface MigrationInfo {
  isBreaking: boolean;
  migrationCount: number;
  schemaVersion?: string;
  rollbackWarning: string;
}

export interface LockTestQueueParams {
  reason: string;                     // Required: reason for lock (min 10 chars)
  durationMinutes?: number;           // Optional: default 60, range 1-480
  lockedBy?: string;                  // Optional: default 'mcp-user'
  metadata?: Record<string, any>;     // Optional: migration context
}

export interface LockTestQueueResponse {
  id: string;                         // Lock UUID
  reason: string;
  lockedBy: string;
  lockedAt: string;                   // ISO 8601
  expiresAt: string;                  // ISO 8601
  message: string;
}

export interface UnlockTestQueueParams {
  lockId?: string;                    // Optional: unlock specific lock
  force?: boolean;                    // Optional: force unlock (default: false)
}

export interface UnlockTestQueueResponse {
  id: string;
  reason: string;
  duration: string;                   // Human readable (e.g., "45 minutes", "1h 23m")
  message: string;
}

export interface QueueLockStatusResponse {
  isLocked: boolean;
  lock?: {
    id: string;
    reason: string;
    lockedBy: string;
    lockedAt: string;                 // ISO 8601
    expiresAt: string;                // ISO 8601
    expiresIn: string;                // Human readable (e.g., "15 minutes")
    isExpired: boolean;
  };
}
