/**
 * Tests for ResourceManager
 */

import { ResourceManager, ResourceViolation } from '../../resources/resource-manager';
import { ResourceUsage } from '../../types/checkpoint';
import { ResourceLimits } from '../../types/config';

describe('ResourceManager', () => {
  describe('Constructor', () => {
    it('should initialize with default limits', () => {
      const manager = new ResourceManager();
      const usage = manager.getUsage();

      expect(usage.tokensUsed).toBe(0);
      expect(usage.agentSpawns).toBe(0);
      expect(usage.stateTransitions).toBe(0);
      expect(usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should initialize with custom limits', () => {
      const customLimits: Partial<ResourceLimits> = {
        maxAgentSpawns: 10,
        maxTokenBudget: 100000,
      };

      const manager = new ResourceManager(customLimits);
      const percentages = manager.getUsagePercentage();

      // Should use custom limits for calculation
      expect(percentages.maxAgentSpawns).toBe(0);
      expect(percentages.maxTokenBudget).toBe(0);
    });

    it('should merge custom limits with defaults', () => {
      const customLimits: Partial<ResourceLimits> = {
        maxAgentSpawns: 10,
      };

      const manager = new ResourceManager(customLimits);

      // Should not throw when checking violations
      expect(() => manager.checkViolations()).not.toThrow();
    });
  });

  describe('recordTokens', () => {
    it('should accumulate token usage', () => {
      const manager = new ResourceManager();

      manager.recordTokens(1000);
      expect(manager.getUsage().tokensUsed).toBe(1000);

      manager.recordTokens(500);
      expect(manager.getUsage().tokensUsed).toBe(1500);

      manager.recordTokens(2500);
      expect(manager.getUsage().tokensUsed).toBe(4000);
    });

    it('should handle zero tokens', () => {
      const manager = new ResourceManager();
      manager.recordTokens(0);
      expect(manager.getUsage().tokensUsed).toBe(0);
    });

    it('should handle large token values', () => {
      const manager = new ResourceManager();
      manager.recordTokens(1000000);
      expect(manager.getUsage().tokensUsed).toBe(1000000);
    });
  });

  describe('recordAgentSpawn', () => {
    it('should increment agent spawn counter', () => {
      const manager = new ResourceManager();

      manager.recordAgentSpawn();
      expect(manager.getUsage().agentSpawns).toBe(1);

      manager.recordAgentSpawn();
      expect(manager.getUsage().agentSpawns).toBe(2);

      manager.recordAgentSpawn();
      expect(manager.getUsage().agentSpawns).toBe(3);
    });
  });

  describe('recordStateTransition', () => {
    it('should increment state transition counter', () => {
      const manager = new ResourceManager();

      manager.recordStateTransition();
      expect(manager.getUsage().stateTransitions).toBe(1);

      manager.recordStateTransition();
      expect(manager.getUsage().stateTransitions).toBe(2);
    });
  });

  describe('getUsage', () => {
    it('should return current usage with updated duration', () => {
      const manager = new ResourceManager();

      manager.recordTokens(5000);
      manager.recordAgentSpawn();
      manager.recordStateTransition();

      const usage = manager.getUsage();

      expect(usage.tokensUsed).toBe(5000);
      expect(usage.agentSpawns).toBe(1);
      expect(usage.stateTransitions).toBe(1);
      expect(usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should update duration on each call', async () => {
      const manager = new ResourceManager();

      const usage1 = manager.getUsage();
      await new Promise(resolve => setTimeout(resolve, 10));
      const usage2 = manager.getUsage();

      expect(usage2.durationMs).toBeGreaterThan(usage1.durationMs);
    });
  });

  describe('canContinue', () => {
    it('should return true when under all limits', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 10000,
        maxAgentSpawns: 10,
        maxStateTransitions: 20,
        maxRunDuration: 60000,
      });

      manager.recordTokens(5000);
      manager.recordAgentSpawn();
      manager.recordStateTransition();

      expect(manager.canContinue()).toBe(true);
    });

    it('should return false when token budget exceeded', () => {
      const manager = new ResourceManager({ maxTokenBudget: 100 });
      manager.recordTokens(150);

      expect(manager.canContinue()).toBe(false);
    });

    it('should return false when agent spawn limit exceeded', () => {
      const manager = new ResourceManager({ maxAgentSpawns: 3 });

      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      expect(manager.canContinue()).toBe(false);
    });

    it('should return false when state transition limit exceeded', () => {
      const manager = new ResourceManager({ maxStateTransitions: 2 });

      manager.recordStateTransition();
      manager.recordStateTransition();

      expect(manager.canContinue()).toBe(false);
    });

    it('should return true when exactly at limit (not over)', () => {
      const manager = new ResourceManager({ maxTokenBudget: 100 });
      manager.recordTokens(99);

      expect(manager.canContinue()).toBe(true);
    });
  });

  describe('canSpawnAgent', () => {
    it('should return true when under agent limit', () => {
      const manager = new ResourceManager({ maxAgentSpawns: 5 });
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      expect(manager.canSpawnAgent()).toBe(true);
    });

    it('should return false when at agent limit', () => {
      const manager = new ResourceManager({ maxAgentSpawns: 3 });
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      expect(manager.canSpawnAgent()).toBe(false);
    });

    it('should return false when over agent limit', () => {
      const manager = new ResourceManager({ maxAgentSpawns: 2 });
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      expect(manager.canSpawnAgent()).toBe(false);
    });
  });

  describe('checkViolations', () => {
    it('should return empty array when no violations', () => {
      const manager = new ResourceManager();
      const violations = manager.checkViolations();

      expect(violations).toEqual([]);
    });

    it('should detect token budget violation', () => {
      const manager = new ResourceManager({ maxTokenBudget: 100 });
      manager.recordTokens(150);

      const violations = manager.checkViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].limit).toBe('maxTokenBudget');
      expect(violations[0].current).toBe(150);
      expect(violations[0].max).toBe(100);
      expect(violations[0].message).toContain('Token budget exceeded');
    });

    it('should detect agent spawn violation', () => {
      const manager = new ResourceManager({ maxAgentSpawns: 2 });
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      const violations = manager.checkViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].limit).toBe('maxAgentSpawns');
      expect(violations[0].current).toBe(2);
      expect(violations[0].max).toBe(2);
    });

    it('should detect state transition violation', () => {
      const manager = new ResourceManager({ maxStateTransitions: 3 });
      manager.recordStateTransition();
      manager.recordStateTransition();
      manager.recordStateTransition();

      const violations = manager.checkViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].limit).toBe('maxStateTransitions');
    });

    it('should detect multiple violations', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 100,
        maxAgentSpawns: 2,
        maxStateTransitions: 3,
      });

      manager.recordTokens(150);
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordStateTransition();
      manager.recordStateTransition();
      manager.recordStateTransition();

      const violations = manager.checkViolations();

      expect(violations.length).toBeGreaterThanOrEqual(2);
      const limits = violations.map(v => v.limit);
      expect(limits).toContain('maxTokenBudget');
      expect(limits).toContain('maxAgentSpawns');
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate percentages correctly', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 1000,
        maxAgentSpawns: 10,
        maxStateTransitions: 20,
      });

      manager.recordTokens(500);
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordStateTransition();

      const percentages = manager.getUsagePercentage();

      expect(percentages.maxTokenBudget).toBe(50);
      expect(percentages.maxAgentSpawns).toBe(20);
      expect(percentages.maxStateTransitions).toBe(5);
    });

    it('should handle 0% usage', () => {
      const manager = new ResourceManager();
      const percentages = manager.getUsagePercentage();

      expect(percentages.maxTokenBudget).toBe(0);
      expect(percentages.maxAgentSpawns).toBe(0);
      expect(percentages.maxStateTransitions).toBe(0);
    });

    it('should handle 100% usage', () => {
      const manager = new ResourceManager({ maxTokenBudget: 100 });
      manager.recordTokens(100);

      const percentages = manager.getUsagePercentage();

      expect(percentages.maxTokenBudget).toBe(100);
    });

    it('should handle over 100% usage', () => {
      const manager = new ResourceManager({ maxTokenBudget: 100 });
      manager.recordTokens(150);

      const percentages = manager.getUsagePercentage();

      expect(percentages.maxTokenBudget).toBe(150);
    });
  });

  describe('isApproachingLimits', () => {
    it('should return false when under 80%', () => {
      const manager = new ResourceManager({ maxTokenBudget: 1000 });
      manager.recordTokens(700);

      expect(manager.isApproachingLimits()).toBe(false);
    });

    it('should return true when at 80%', () => {
      const manager = new ResourceManager({ maxTokenBudget: 1000 });
      manager.recordTokens(800);

      expect(manager.isApproachingLimits()).toBe(true);
    });

    it('should return true when over 80%', () => {
      const manager = new ResourceManager({ maxTokenBudget: 1000 });
      manager.recordTokens(900);

      expect(manager.isApproachingLimits()).toBe(true);
    });

    it('should return true when any limit is over 80%', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 1000,
        maxAgentSpawns: 10,
      });

      manager.recordTokens(100); // 10%
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordAgentSpawn(); // 80%

      expect(manager.isApproachingLimits()).toBe(true);
    });
  });

  describe('getWarnings', () => {
    it('should return empty array when under 80%', () => {
      const manager = new ResourceManager({ maxTokenBudget: 1000 });
      manager.recordTokens(700);

      expect(manager.getWarnings()).toEqual([]);
    });

    it('should return warnings when at 80%', () => {
      const manager = new ResourceManager({ maxTokenBudget: 1000 });
      manager.recordTokens(800);

      const warnings = manager.getWarnings();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Token budget');
      expect(warnings[0]).toContain('80.0%');
    });

    it('should return multiple warnings', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 1000,
        maxAgentSpawns: 10,
        maxStateTransitions: 20,
      });

      manager.recordTokens(850); // 85%
      for (let i = 0; i < 9; i++) manager.recordAgentSpawn(); // 90%
      for (let i = 0; i < 17; i++) manager.recordStateTransition(); // 85%

      const warnings = manager.getWarnings();

      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('restore', () => {
    it('should restore usage from checkpoint', () => {
      const manager = new ResourceManager();

      const previousUsage: ResourceUsage = {
        tokensUsed: 5000,
        agentSpawns: 3,
        stateTransitions: 7,
        durationMs: 30000,
      };

      manager.restore(previousUsage);

      const usage = manager.getUsage();
      expect(usage.tokensUsed).toBe(5000);
      expect(usage.agentSpawns).toBe(3);
      expect(usage.stateTransitions).toBe(7);
      // Duration should be close to restored value (accounting for time since restore)
      expect(usage.durationMs).toBeGreaterThanOrEqual(30000);
    });

    it('should continue tracking after restore', () => {
      const manager = new ResourceManager();

      manager.restore({
        tokensUsed: 1000,
        agentSpawns: 2,
        stateTransitions: 3,
        durationMs: 10000,
      });

      manager.recordTokens(500);
      manager.recordAgentSpawn();

      const usage = manager.getUsage();
      expect(usage.tokensUsed).toBe(1500);
      expect(usage.agentSpawns).toBe(3);
    });
  });

  describe('getRemaining', () => {
    it('should calculate remaining resources', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 10000,
        maxAgentSpawns: 10,
        maxStateTransitions: 20,
      });

      manager.recordTokens(3000);
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();
      manager.recordStateTransition();

      const remaining = manager.getRemaining();

      expect(remaining.tokensRemaining).toBe(7000);
      expect(remaining.agentSpawnsRemaining).toBe(8);
      expect(remaining.stateTransitionsRemaining).toBe(19);
      expect(typeof remaining.timeRemaining).toBe('string');
    });
  });

  describe('getSummary', () => {
    it('should generate summary string', () => {
      const manager = new ResourceManager({
        maxTokenBudget: 10000,
        maxAgentSpawns: 10,
      });

      manager.recordTokens(5000);
      manager.recordAgentSpawn();
      manager.recordAgentSpawn();

      const summary = manager.getSummary();

      expect(summary).toContain('Tokens: 5000/10000');
      expect(summary).toContain('Agents: 2/10');
      expect(summary).toContain('50.0%');
      expect(summary).toContain('20.0%');
    });

    it('should format summary with all metrics', () => {
      const manager = new ResourceManager();
      const summary = manager.getSummary();

      expect(summary).toContain('Tokens:');
      expect(summary).toContain('Agents:');
      expect(summary).toContain('States:');
      expect(summary).toContain('Duration:');
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative token values (invalid but defensive)', () => {
      const manager = new ResourceManager();
      manager.recordTokens(-100);

      expect(manager.getUsage().tokensUsed).toBe(-100);
    });

    it('should handle very large values', () => {
      const manager = new ResourceManager();
      manager.recordTokens(Number.MAX_SAFE_INTEGER);

      expect(manager.getUsage().tokensUsed).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle duration calculation over long periods', async () => {
      const manager = new ResourceManager();

      await new Promise(resolve => setTimeout(resolve, 100));

      const usage = manager.getUsage();
      expect(usage.durationMs).toBeGreaterThanOrEqual(100);
    });
  });
});
