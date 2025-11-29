/**
 * Resource Manager
 * Tracks and enforces resource limits during workflow execution
 */

import { ResourceLimits, ResourceUsage, DEFAULT_LIMITS } from '../types';

/**
 * Resource limit violation
 */
export interface ResourceViolation {
  limit: keyof ResourceLimits;
  current: number;
  max: number;
  message: string;
}

/**
 * Resource Manager
 * Monitors token usage, agent spawns, state transitions, and duration
 */
export class ResourceManager {
  private limits: ResourceLimits;
  private usage: ResourceUsage;
  private startTime: number;

  constructor(limits?: Partial<ResourceLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.startTime = Date.now();
    this.usage = {
      tokensUsed: 0,
      agentSpawns: 0,
      stateTransitions: 0,
      durationMs: 0,
    };
  }

  /**
   * Restore usage from checkpoint
   */
  restore(usage: ResourceUsage): void {
    this.usage = { ...usage };
    // Adjust start time based on previous duration
    this.startTime = Date.now() - usage.durationMs;
    console.log(`[ResourceManager] Restored usage: ${JSON.stringify(usage)}`);
  }

  /**
   * Get current usage
   */
  getUsage(): ResourceUsage {
    return {
      ...this.usage,
      durationMs: Date.now() - this.startTime,
    };
  }

  /**
   * Record token usage
   */
  recordTokens(tokens: number): void {
    this.usage.tokensUsed += tokens;
    console.log(`[ResourceManager] Tokens: ${this.usage.tokensUsed}/${this.limits.maxTokenBudget}`);
  }

  /**
   * Record agent spawn
   */
  recordAgentSpawn(): void {
    this.usage.agentSpawns++;
    console.log(`[ResourceManager] Agent spawns: ${this.usage.agentSpawns}/${this.limits.maxAgentSpawns}`);
  }

  /**
   * Record state transition
   */
  recordStateTransition(): void {
    this.usage.stateTransitions++;
    console.log(`[ResourceManager] State transitions: ${this.usage.stateTransitions}/${this.limits.maxStateTransitions}`);
  }

  /**
   * Check if execution can continue
   */
  canContinue(): boolean {
    const violations = this.checkViolations();
    return violations.length === 0;
  }

  /**
   * Check if agent can be spawned
   */
  canSpawnAgent(): boolean {
    return this.usage.agentSpawns < this.limits.maxAgentSpawns;
  }

  /**
   * Check for any limit violations
   */
  checkViolations(): ResourceViolation[] {
    const violations: ResourceViolation[] = [];
    const currentDuration = Date.now() - this.startTime;

    // Check token budget
    if (this.usage.tokensUsed >= this.limits.maxTokenBudget) {
      violations.push({
        limit: 'maxTokenBudget',
        current: this.usage.tokensUsed,
        max: this.limits.maxTokenBudget,
        message: `Token budget exceeded: ${this.usage.tokensUsed}/${this.limits.maxTokenBudget}`,
      });
    }

    // Check agent spawns
    if (this.usage.agentSpawns >= this.limits.maxAgentSpawns) {
      violations.push({
        limit: 'maxAgentSpawns',
        current: this.usage.agentSpawns,
        max: this.limits.maxAgentSpawns,
        message: `Agent spawn limit exceeded: ${this.usage.agentSpawns}/${this.limits.maxAgentSpawns}`,
      });
    }

    // Check state transitions
    if (this.usage.stateTransitions >= this.limits.maxStateTransitions) {
      violations.push({
        limit: 'maxStateTransitions',
        current: this.usage.stateTransitions,
        max: this.limits.maxStateTransitions,
        message: `State transition limit exceeded: ${this.usage.stateTransitions}/${this.limits.maxStateTransitions}`,
      });
    }

    // Check duration
    if (currentDuration >= this.limits.maxRunDuration) {
      violations.push({
        limit: 'maxRunDuration',
        current: currentDuration,
        max: this.limits.maxRunDuration,
        message: `Run duration exceeded: ${this.formatDuration(currentDuration)}/${this.formatDuration(this.limits.maxRunDuration)}`,
      });
    }

    return violations;
  }

  /**
   * Get percentage of limit used
   */
  getUsagePercentage(): Record<keyof ResourceLimits, number> {
    const currentDuration = Date.now() - this.startTime;

    return {
      maxTokenBudget: (this.usage.tokensUsed / this.limits.maxTokenBudget) * 100,
      maxAgentSpawns: (this.usage.agentSpawns / this.limits.maxAgentSpawns) * 100,
      maxStateTransitions: (this.usage.stateTransitions / this.limits.maxStateTransitions) * 100,
      maxRunDuration: (currentDuration / this.limits.maxRunDuration) * 100,
      maxConcurrentRuns: 0, // Not tracked per-run
    };
  }

  /**
   * Get remaining resources
   */
  getRemaining(): Record<string, number | string> {
    const currentDuration = Date.now() - this.startTime;

    return {
      tokensRemaining: this.limits.maxTokenBudget - this.usage.tokensUsed,
      agentSpawnsRemaining: this.limits.maxAgentSpawns - this.usage.agentSpawns,
      stateTransitionsRemaining: this.limits.maxStateTransitions - this.usage.stateTransitions,
      timeRemaining: this.formatDuration(this.limits.maxRunDuration - currentDuration),
    };
  }

  /**
   * Check if approaching limits (>80%)
   */
  isApproachingLimits(): boolean {
    const percentages = this.getUsagePercentage();
    return Object.values(percentages).some(p => p >= 80);
  }

  /**
   * Get warnings for approaching limits
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const percentages = this.getUsagePercentage();

    if (percentages.maxTokenBudget >= 80) {
      warnings.push(`Token budget at ${percentages.maxTokenBudget.toFixed(1)}%`);
    }
    if (percentages.maxAgentSpawns >= 80) {
      warnings.push(`Agent spawns at ${percentages.maxAgentSpawns.toFixed(1)}%`);
    }
    if (percentages.maxStateTransitions >= 80) {
      warnings.push(`State transitions at ${percentages.maxStateTransitions.toFixed(1)}%`);
    }
    if (percentages.maxRunDuration >= 80) {
      warnings.push(`Run duration at ${percentages.maxRunDuration.toFixed(1)}%`);
    }

    return warnings;
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get a summary of current resource usage
   */
  getSummary(): string {
    const usage = this.getUsage();
    const percentages = this.getUsagePercentage();

    return [
      `Tokens: ${usage.tokensUsed}/${this.limits.maxTokenBudget} (${percentages.maxTokenBudget.toFixed(1)}%)`,
      `Agents: ${usage.agentSpawns}/${this.limits.maxAgentSpawns} (${percentages.maxAgentSpawns.toFixed(1)}%)`,
      `States: ${usage.stateTransitions}/${this.limits.maxStateTransitions} (${percentages.maxStateTransitions.toFixed(1)}%)`,
      `Duration: ${this.formatDuration(usage.durationMs)}/${this.formatDuration(this.limits.maxRunDuration)} (${percentages.maxRunDuration.toFixed(1)}%)`,
    ].join(' | ');
  }
}
