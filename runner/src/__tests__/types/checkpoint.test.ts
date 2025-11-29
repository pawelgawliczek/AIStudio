/**
 * Tests for Checkpoint types and validation
 */

import {
  RunnerCheckpoint,
  ExecutionPhase,
  ResourceUsage,
  CheckpointError,
  createCheckpoint,
  isValidCheckpoint,
} from '../../types/checkpoint';

describe('Checkpoint Types', () => {
  describe('createCheckpoint', () => {
    it('should create valid checkpoint with required fields', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1');

      expect(checkpoint.version).toBe(1);
      expect(checkpoint.runId).toBe('run-1');
      expect(checkpoint.workflowId).toBe('workflow-1');
      expect(checkpoint.masterSessionId).toBe('master-session-1');
      expect(checkpoint.storyId).toBeUndefined();
    });

    it('should create checkpoint with story ID', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1', 'story-1');

      expect(checkpoint.storyId).toBe('story-1');
    });

    it('should initialize with empty state', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1');

      expect(checkpoint.currentStateId).toBe('');
      expect(checkpoint.currentPhase).toBe('pre');
      expect(checkpoint.completedStates).toEqual([]);
      expect(checkpoint.skippedStates).toEqual([]);
    });

    it('should initialize resource usage to zero', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1');

      expect(checkpoint.resourceUsage.agentSpawns).toBe(0);
      expect(checkpoint.resourceUsage.tokensUsed).toBe(0);
      expect(checkpoint.resourceUsage.stateTransitions).toBe(0);
      expect(checkpoint.resourceUsage.durationMs).toBe(0);
    });

    it('should set timestamps', () => {
      const beforeCreate = Date.now();
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1');
      const afterCreate = Date.now();

      const checkpointTime = new Date(checkpoint.checkpointedAt).getTime();

      expect(checkpointTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(checkpointTime).toBeLessThanOrEqual(afterCreate);
      expect(checkpoint.runStartedAt).toBe(checkpoint.checkpointedAt);
    });

    it('should not have lastError initially', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1');

      expect(checkpoint.lastError).toBeUndefined();
    });
  });

  describe('isValidCheckpoint', () => {
    let validCheckpoint: RunnerCheckpoint;

    beforeEach(() => {
      validCheckpoint = createCheckpoint('run-1', 'workflow-1', 'master-session-1', 'story-1');
    });

    it('should return true for valid checkpoint', () => {
      expect(isValidCheckpoint(validCheckpoint)).toBe(true);
    });

    it('should return true for checkpoint with completed states', () => {
      validCheckpoint.completedStates = ['state-1', 'state-2'];
      expect(isValidCheckpoint(validCheckpoint)).toBe(true);
    });

    it('should return true for checkpoint with skipped states', () => {
      validCheckpoint.skippedStates = ['state-3', 'state-4'];
      expect(isValidCheckpoint(validCheckpoint)).toBe(true);
    });

    it('should return true for checkpoint with error', () => {
      validCheckpoint.lastError = {
        message: 'Test error',
        stateId: 'state-1',
        recoveryAttempts: 1,
        occurredAt: new Date().toISOString(),
      };
      expect(isValidCheckpoint(validCheckpoint)).toBe(true);
    });

    it('should return true for checkpoint with resource usage', () => {
      validCheckpoint.resourceUsage = {
        agentSpawns: 5,
        tokensUsed: 10000,
        stateTransitions: 3,
        durationMs: 60000,
      };
      expect(isValidCheckpoint(validCheckpoint)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidCheckpoint(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidCheckpoint(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidCheckpoint('string')).toBe(false);
      expect(isValidCheckpoint(123)).toBe(false);
      expect(isValidCheckpoint(true)).toBe(false);
    });

    it('should return false for wrong version', () => {
      const invalid = { ...validCheckpoint, version: 2 };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing version', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).version;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing runId', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).runId;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for non-string runId', () => {
      const invalid = { ...validCheckpoint, runId: 123 };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing workflowId', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).workflowId;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing currentStateId', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).currentStateId;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing masterSessionId', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).masterSessionId;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for invalid currentPhase', () => {
      const invalid = { ...validCheckpoint, currentPhase: 'invalid' };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return true for all valid phases', () => {
      const phases: ExecutionPhase[] = ['pre', 'agent', 'post'];

      phases.forEach(phase => {
        const checkpoint = { ...validCheckpoint, currentPhase: phase };
        expect(isValidCheckpoint(checkpoint)).toBe(true);
      });
    });

    it('should return false for non-array completedStates', () => {
      const invalid = { ...validCheckpoint, completedStates: 'not-array' };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for non-array skippedStates', () => {
      const invalid = { ...validCheckpoint, skippedStates: 'not-array' };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing resourceUsage', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).resourceUsage;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for null resourceUsage', () => {
      const invalid = { ...validCheckpoint, resourceUsage: null };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for non-object resourceUsage', () => {
      const invalid = { ...validCheckpoint, resourceUsage: 'string' };
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing checkpointedAt', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).checkpointedAt;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });

    it('should return false for missing runStartedAt', () => {
      const invalid = { ...validCheckpoint };
      delete (invalid as any).runStartedAt;
      expect(isValidCheckpoint(invalid)).toBe(false);
    });
  });

  describe('Type Interfaces', () => {
    it('should allow ResourceUsage with all fields', () => {
      const usage: ResourceUsage = {
        agentSpawns: 10,
        tokensUsed: 50000,
        stateTransitions: 8,
        durationMs: 120000,
      };

      expect(usage.agentSpawns).toBe(10);
      expect(usage.tokensUsed).toBe(50000);
      expect(usage.stateTransitions).toBe(8);
      expect(usage.durationMs).toBe(120000);
    });

    it('should allow CheckpointError with all fields', () => {
      const error: CheckpointError = {
        message: 'Component failed',
        stateId: 'state-123',
        recoveryAttempts: 2,
        occurredAt: new Date().toISOString(),
      };

      expect(error.message).toBe('Component failed');
      expect(error.stateId).toBe('state-123');
      expect(error.recoveryAttempts).toBe(2);
      expect(error.occurredAt).toBeTruthy();
    });

    it('should allow RunnerCheckpoint with optional storyId', () => {
      const checkpoint1 = createCheckpoint('run-1', 'workflow-1', 'session-1');
      const checkpoint2 = createCheckpoint('run-2', 'workflow-2', 'session-2', 'story-1');

      expect(checkpoint1.storyId).toBeUndefined();
      expect(checkpoint2.storyId).toBe('story-1');
    });

    it('should allow RunnerCheckpoint with optional lastError', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'session-1');

      expect(checkpoint.lastError).toBeUndefined();

      checkpoint.lastError = {
        message: 'Error occurred',
        stateId: 'state-1',
        recoveryAttempts: 1,
        occurredAt: new Date().toISOString(),
      };

      expect(checkpoint.lastError).toBeDefined();
      expect(isValidCheckpoint(checkpoint)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle checkpoint with empty completedStates', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'session-1');
      checkpoint.completedStates = [];
      expect(isValidCheckpoint(checkpoint)).toBe(true);
    });

    it('should handle checkpoint with many completed states', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'session-1');
      checkpoint.completedStates = Array.from({ length: 100 }, (_, i) => `state-${i}`);
      expect(isValidCheckpoint(checkpoint)).toBe(true);
    });

    it('should handle checkpoint with large resource values', () => {
      const checkpoint = createCheckpoint('run-1', 'workflow-1', 'session-1');
      checkpoint.resourceUsage = {
        agentSpawns: 1000,
        tokensUsed: 1000000,
        stateTransitions: 500,
        durationMs: 7200000, // 2 hours
      };
      expect(isValidCheckpoint(checkpoint)).toBe(true);
    });
  });
});
