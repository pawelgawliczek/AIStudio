import { Injectable, Logger } from '@nestjs/common';
import { BreakpointPosition, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Breakpoint data structure
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */
export interface BreakpointData {
  id: string;
  stateId: string;
  stateName: string;
  stateOrder: number;
  position: BreakpointPosition;
  isActive: boolean;
  isTemporary: boolean;
  condition: Record<string, unknown> | null;
  hitAt: Date | null;
  createdAt: Date;
}

/**
 * Execution context for condition evaluation
 */
export interface BreakpointContext {
  tokensUsed: number;
  agentSpawns: number;
  stateTransitions: number;
  durationMs: number;
  currentStateIndex: number;
  totalStates: number;
  previousStateOutput?: Record<string, unknown>;
}

/**
 * Breakpoint Service
 * Provides breakpoint operations for Story Runner
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */
@Injectable()
export class BreakpointService {
  private readonly logger = new Logger(BreakpointService.name);

  // In-memory cache of breakpoints per run (cleared on sync)
  private breakpointCache: Map<string, {
    breakpoints: BreakpointData[];
    loadedAt: Date;
    breakpointsModifiedAt?: string;
  }> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Load all active breakpoints for a workflow run
   * Includes state info for condition evaluation
   */
  async loadBreakpoints(runId: string): Promise<BreakpointData[]> {
    this.logger.log(`Loading breakpoints for run ${runId}`);

    const breakpoints = await this.prisma.runnerBreakpoint.findMany({
      where: {
        workflowRunId: runId,
        isActive: true,
      },
      include: {
        state: {
          select: {
            name: true,
            order: true,
          },
        },
      },
      orderBy: [
        { state: { order: 'asc' } },
        { position: 'asc' },
      ],
    });

    const result: BreakpointData[] = breakpoints.map(bp => ({
      id: bp.id,
      stateId: bp.stateId,
      stateName: bp.state.name,
      stateOrder: bp.state.order,
      position: bp.position,
      isActive: bp.isActive,
      isTemporary: bp.isTemporary,
      condition: bp.condition as Record<string, unknown> | null,
      hitAt: bp.hitAt,
      createdAt: bp.createdAt,
    }));

    // Update cache
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });
    const metadata = run?.metadata as Record<string, unknown> | null;

    this.breakpointCache.set(runId, {
      breakpoints: result,
      loadedAt: new Date(),
      breakpointsModifiedAt: metadata?.breakpointsModifiedAt as string | undefined,
    });

    this.logger.log(`Loaded ${result.length} active breakpoints for run ${runId}`);
    return result;
  }

  /**
   * Check if breakpoints need to be reloaded (sync changed)
   * Returns true if sync needed, false if cache is valid
   */
  async syncIfNeeded(runId: string): Promise<boolean> {
    const cached = this.breakpointCache.get(runId);
    if (!cached) {
      // No cache, need to load
      await this.loadBreakpoints(runId);
      return true;
    }

    // Check if breakpointsModifiedAt has changed
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });

    const metadata = run?.metadata as Record<string, unknown> | null;
    const currentModifiedAt = metadata?.breakpointsModifiedAt as string | undefined;

    if (currentModifiedAt !== cached.breakpointsModifiedAt) {
      this.logger.log(`Breakpoints modified at changed, reloading for run ${runId}`);
      await this.loadBreakpoints(runId);
      return true;
    }

    return false;
  }

  /**
   * Get cached breakpoints for a run
   * Returns null if not loaded
   */
  getCachedBreakpoints(runId: string): BreakpointData[] | null {
    return this.breakpointCache.get(runId)?.breakpoints ?? null;
  }

  /**
   * Check if execution should pause at a given state and position
   * Evaluates conditions if present
   */
  async shouldPause(
    runId: string,
    stateId: string,
    position: BreakpointPosition,
    context: BreakpointContext
  ): Promise<{ shouldPause: boolean; breakpoint?: BreakpointData; reason?: string }> {
    // Ensure breakpoints are synced
    await this.syncIfNeeded(runId);

    const breakpoints = this.getCachedBreakpoints(runId);
    if (!breakpoints || breakpoints.length === 0) {
      return { shouldPause: false };
    }

    // Find matching breakpoint
    const breakpoint = breakpoints.find(
      bp => bp.stateId === stateId && bp.position === position && bp.isActive
    );

    if (!breakpoint) {
      return { shouldPause: false };
    }

    // Evaluate condition if present
    if (breakpoint.condition) {
      const conditionMet = this.evaluateCondition(breakpoint.condition, context);
      if (!conditionMet) {
        this.logger.debug(
          `Conditional breakpoint at ${position} ${breakpoint.stateName} - condition not met`
        );
        return { shouldPause: false, reason: 'condition_not_met' };
      }
    }

    this.logger.log(
      `Breakpoint hit: ${position} ${breakpoint.stateName} (${breakpoint.id})`
    );

    return {
      shouldPause: true,
      breakpoint,
      reason: breakpoint.condition ? 'conditional_breakpoint_hit' : 'breakpoint_hit',
    };
  }

  /**
   * Record that a breakpoint was hit
   * Updates hitAt timestamp and handles temporary breakpoints
   */
  async recordHit(breakpoint: BreakpointData): Promise<void> {
    this.logger.log(`Recording hit for breakpoint ${breakpoint.id}`);

    if (breakpoint.isTemporary) {
      // Delete temporary breakpoints after hit
      await this.prisma.runnerBreakpoint.delete({
        where: { id: breakpoint.id },
      });
      this.logger.log(`Deleted temporary breakpoint ${breakpoint.id}`);
    } else {
      // Update hit timestamp for persistent breakpoints
      await this.prisma.runnerBreakpoint.update({
        where: { id: breakpoint.id },
        data: { hitAt: new Date() },
      });
    }

    // Invalidate cache to force reload
    this.breakpointCache.delete(breakpoint.id);
  }

  /**
   * Clear cache for a run (call when run ends)
   */
  clearCache(runId: string): void {
    this.breakpointCache.delete(runId);
    this.logger.debug(`Cleared breakpoint cache for run ${runId}`);
  }

  /**
   * Evaluate a JSON condition against the execution context
   * Supports MongoDB-style operators: $gt, $gte, $lt, $lte, $eq, $ne, $and, $or
   */
  evaluateCondition(
    condition: Record<string, unknown>,
    context: BreakpointContext
  ): boolean {
    return this.evaluateExpression(condition, context);
  }

  /**
   * Recursively evaluate a condition expression
   */
  private evaluateExpression(
    expr: Record<string, unknown>,
    context: BreakpointContext
  ): boolean {
    // Handle logical operators
    if ('$and' in expr) {
      const conditions = expr.$and as Record<string, unknown>[];
      return conditions.every(c => this.evaluateExpression(c, context));
    }

    if ('$or' in expr) {
      const conditions = expr.$or as Record<string, unknown>[];
      return conditions.some(c => this.evaluateExpression(c, context));
    }

    if ('$not' in expr) {
      return !this.evaluateExpression(expr.$not as Record<string, unknown>, context);
    }

    // Handle field comparisons
    for (const [field, value] of Object.entries(expr)) {
      if (field.startsWith('$')) {
        continue; // Skip operators, handled above
      }

      const fieldValue = this.getFieldValue(field, context);
      const numericValue = fieldValue as number;

      if (typeof value === 'object' && value !== null) {
        // Comparison operators
        const ops = value as Record<string, unknown>;

        if ('$gt' in ops && !(numericValue > (ops.$gt as number))) return false;
        if ('$gte' in ops && !(numericValue >= (ops.$gte as number))) return false;
        if ('$lt' in ops && !(numericValue < (ops.$lt as number))) return false;
        if ('$lte' in ops && !(numericValue <= (ops.$lte as number))) return false;
        if ('$eq' in ops && fieldValue !== ops.$eq) return false;
        if ('$ne' in ops && fieldValue === ops.$ne) return false;
      } else {
        // Direct equality
        if (fieldValue !== value) return false;
      }
    }

    return true;
  }

  /**
   * Get field value from context
   * Maps condition field names to context properties
   */
  private getFieldValue(field: string, context: BreakpointContext): unknown {
    const fieldMap: Record<string, keyof BreakpointContext> = {
      tokensUsed: 'tokensUsed',
      tokenCount: 'tokensUsed', // Alias
      tokens: 'tokensUsed', // Alias
      agentSpawns: 'agentSpawns',
      spawns: 'agentSpawns', // Alias
      stateTransitions: 'stateTransitions',
      transitions: 'stateTransitions', // Alias
      durationMs: 'durationMs',
      duration: 'durationMs', // Alias
      currentStateIndex: 'currentStateIndex',
      stateIndex: 'currentStateIndex', // Alias
      totalStates: 'totalStates',
    };

    const mappedField = fieldMap[field];
    if (mappedField) {
      return context[mappedField];
    }

    // Check in previousStateOutput
    if (context.previousStateOutput && field in context.previousStateOutput) {
      return context.previousStateOutput[field];
    }

    this.logger.warn(`Unknown condition field: ${field}`);
    return undefined;
  }

  /**
   * Get a breakpoint by ID
   * ST-146: Breakpoint System
   */
  async getBreakpointById(breakpointId: string): Promise<BreakpointData | null> {
    const breakpoint = await this.prisma.runnerBreakpoint.findUnique({
      where: { id: breakpointId },
      include: {
        state: {
          select: {
            name: true,
            order: true,
          },
        },
      },
    });

    if (!breakpoint) {
      return null;
    }

    return {
      id: breakpoint.id,
      stateId: breakpoint.stateId,
      stateName: breakpoint.state.name,
      stateOrder: breakpoint.state.order,
      position: breakpoint.position,
      isActive: breakpoint.isActive,
      isTemporary: breakpoint.isTemporary,
      condition: breakpoint.condition as Record<string, unknown> | null,
      hitAt: breakpoint.hitAt,
      createdAt: breakpoint.createdAt,
    };
  }

  /**
   * Get all breakpoints for display (used by list_breakpoints MCP tool)
   */
  async getAllBreakpoints(
    runId: string,
    includeInactive: boolean = false
  ): Promise<BreakpointData[]> {
    const where: Prisma.RunnerBreakpointWhereInput = {
      workflowRunId: runId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const breakpoints = await this.prisma.runnerBreakpoint.findMany({
      where,
      include: {
        state: {
          select: {
            name: true,
            order: true,
          },
        },
      },
      orderBy: [
        { state: { order: 'asc' } },
        { position: 'asc' },
      ],
    });

    return breakpoints.map(bp => ({
      id: bp.id,
      stateId: bp.stateId,
      stateName: bp.state.name,
      stateOrder: bp.state.order,
      position: bp.position,
      isActive: bp.isActive,
      isTemporary: bp.isTemporary,
      condition: bp.condition as Record<string, unknown> | null,
      hitAt: bp.hitAt,
      createdAt: bp.createdAt,
    }));
  }

  /**
   * Set isPaused flag and reason on workflow run
   */
  async setPaused(
    runId: string,
    isPaused: boolean,
    reason?: string
  ): Promise<void> {
    this.logger.log(`Setting isPaused=${isPaused} for run ${runId}`);

    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });

    const metadata = (run?.metadata as Record<string, unknown>) || {};

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        isPaused,
        pauseReason: reason || null,
        metadata: {
          ...metadata,
          lastPausedAt: isPaused ? new Date().toISOString() : metadata.lastPausedAt,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
