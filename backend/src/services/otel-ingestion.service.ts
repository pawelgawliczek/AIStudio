import { PrismaClient, Prisma, OtelEvent, ComponentRun } from '@prisma/client';
import { Logger } from '../utils/logger';

interface OtelEventData {
  sessionId: string;
  timestamp: Date;
  eventType: string;
  eventName?: string;
  attributes?: any;
  metadata?: any;
}

interface WorkflowMetadata {
  runId?: string;
  componentRunId?: string;
  componentId?: string;
}

interface TokenMetrics {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

interface ToolMetrics {
  toolName: string;
  duration?: number;
  success?: boolean;
  error?: string;
  parameters?: any;
}

/**
 * Service for ingesting and processing OTEL (OpenTelemetry) events
 * Handles Claude Code telemetry data and maps it to component runs
 */
type ComponentRunWithWorkflow = Prisma.ComponentRunGetPayload<{
  include: { workflowRun: true };
}>;

export class OtelIngestionService {
  private readonly logger = new Logger('OtelIngestionService');

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Parse workflow metadata from event attributes
   * Extracts runId, componentRunId from [WORKFLOW_METADATA: ...] tags
   */
  parseMetadata(attributes: any): WorkflowMetadata {
    const metadata: WorkflowMetadata = {};

    if (!attributes) return metadata;

    // Convert to string to search for metadata
    const searchString = JSON.stringify(attributes);

    // Look for [WORKFLOW_METADATA: runId=xxx, componentRunId=yyy, componentId=zzz]
    const metadataRegex = /\[WORKFLOW_METADATA:\s*([^\]]+)\]/;
    const match = searchString.match(metadataRegex);

    if (match) {
      const metadataString = match[1];
      const pairs = metadataString.split(',');

      pairs.forEach(pair => {
        const [key, value] = pair.trim().split('=');
        if (key && value) {
          metadata[key.trim() as keyof WorkflowMetadata] = value.trim();
        }
      });
    }

    return metadata;
  }

  /**
   * Ingest a single OTEL event
   * Creates event record and updates component run metrics
   */
  async ingestEvent(eventData: OtelEventData): Promise<OtelEvent> {
    const metadata = this.parseMetadata(eventData.attributes);

    // Find component run by session ID
    let componentRun: ComponentRunWithWorkflow | null = null;
    if (eventData.sessionId) {
      componentRun = await this.prisma.componentRun.findFirst({
        where: { sessionId: eventData.sessionId },
        include: { workflowRun: true }
      });
    }

    // Create OTEL event record
    const otelEvent = await this.prisma.otelEvent.create({
      data: {
        projectId: componentRun?.workflowRun.projectId || '', // Will need proper project ID
        sessionId: eventData.sessionId,
        workflowRunId: metadata.runId || componentRun?.workflowRunId,
        componentRunId: metadata.componentRunId || componentRun?.id,
        timestamp: eventData.timestamp,
        eventType: eventData.eventType,
        eventName: eventData.eventName,
        metadata: eventData.metadata || eventData.attributes,
        attributes: eventData.attributes,
        // Tool-specific fields
        toolName: this.extractToolName(eventData),
        toolParameters: this.extractToolParameters(eventData),
        toolDuration: this.extractToolDuration(eventData),
        toolSuccess: this.extractToolSuccess(eventData),
        toolError: this.extractToolError(eventData),
      }
    });

    // Update component run metrics in real-time
    if (componentRun) {
      await this.updateComponentMetrics(componentRun.id, eventData);
    }

    return otelEvent;
  }

  /**
   * Aggregate metrics from OTEL events for a component run
   */
  async aggregateMetrics(componentRunId: string) {
    const events = await this.prisma.otelEvent.findMany({
      where: { componentRunId, processed: false }
    });

    if (events.length === 0) return;

    // Aggregate token metrics
    const tokenMetrics = this.aggregateTokenMetrics(events);

    // Aggregate tool usage
    const toolMetrics = this.aggregateToolMetrics(events);

    // Aggregate cache metrics
    const cacheMetrics = this.aggregateCacheMetrics(events);

    // Update component run with aggregated metrics
    // ST-110: Cache metrics removed - now using /context command for token tracking
    await this.prisma.componentRun.update({
      where: { id: componentRunId },
      data: {
        tokensInput: { increment: tokenMetrics.input },
        tokensOutput: { increment: tokenMetrics.output },
        totalTokens: { increment: tokenMetrics.total },
        toolBreakdown: toolMetrics.breakdown,
        errorRate: toolMetrics.errorRate,
        successRate: toolMetrics.successRate,
      }
    });

    // Mark events as processed
    await this.prisma.otelEvent.updateMany({
      where: { componentRunId, processed: false },
      data: { processed: true, aggregatedAt: new Date() }
    });
  }

  /**
   * Map a Claude Code session to a component run
   */
  async mapSessionToComponent(sessionId: string, componentRunId: string) {
    // Update component run with session ID
    await this.prisma.componentRun.update({
      where: { id: componentRunId },
      data: { sessionId }
    });

    // Update any existing OTEL events with component run ID
    await this.prisma.otelEvent.updateMany({
      where: { sessionId, componentRunId: null },
      data: { componentRunId }
    });
  }

  // Private helper methods

  private extractToolName(eventData: OtelEventData): string | undefined {
    if (eventData.eventType === 'claude_code.tool_use') {
      return eventData.attributes?.toolName || eventData.metadata?.toolName;
    }
    return undefined;
  }

  private extractToolParameters(eventData: OtelEventData): any {
    if (eventData.eventType === 'claude_code.tool_use') {
      return eventData.attributes?.parameters || eventData.metadata?.parameters;
    }
    return undefined;
  }

  private extractToolDuration(eventData: OtelEventData): number | undefined {
    if (eventData.eventType === 'claude_code.tool_use') {
      const duration = eventData.attributes?.duration || eventData.metadata?.duration;
      return duration ? duration / 1000 : undefined; // Convert ms to seconds
    }
    return undefined;
  }

  private extractToolSuccess(eventData: OtelEventData): boolean | undefined {
    if (eventData.eventType === 'claude_code.tool_use') {
      return eventData.attributes?.success ?? eventData.metadata?.success;
    }
    return undefined;
  }

  private extractToolError(eventData: OtelEventData): string | undefined {
    if (eventData.eventType === 'claude_code.tool_use') {
      return eventData.attributes?.error || eventData.metadata?.error;
    }
    return undefined;
  }

  private async updateComponentMetrics(componentRunId: string, eventData: OtelEventData) {
    const updates: any = {};

    // Update token counts from API requests
    // ST-110: Cache metrics removed - now using /context command for token tracking
    if (eventData.eventType === 'claude_code.api_request') {
      const tokens = eventData.metadata?.tokens || eventData.attributes?.tokens;
      if (tokens) {
        if (tokens.input) updates.tokensInput = { increment: tokens.input };
        if (tokens.output) updates.tokensOutput = { increment: tokens.output };
        // ST-110: Cache token fields removed from DB schema
      }
    }

    // ST-110: Cache hit/miss tracking removed - now using /context command

    // Update user prompts
    if (eventData.eventType === 'claude_code.user_prompt') {
      updates.userPrompts = { increment: 1 };
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.componentRun.update({
        where: { id: componentRunId },
        data: updates
      });
    }
  }

  private aggregateTokenMetrics(events: OtelEvent[]) {
    let input = 0;
    let output = 0;
    let cacheRead = 0;
    let cacheWrite = 0;

    events.forEach(event => {
      if (event.eventType === 'claude_code.api_request' && event.metadata) {
        const metadata = event.metadata as any;
        const tokens = metadata.tokens || {};
        input += tokens.input || 0;
        output += tokens.output || 0;
        cacheRead += tokens.cache_read || 0;
        cacheWrite += tokens.cache_write || 0;
      }
    });

    return {
      input,
      output,
      cacheRead,
      cacheWrite,
      total: input + output + cacheRead + cacheWrite
    };
  }

  private aggregateToolMetrics(events: OtelEvent[]) {
    const toolStats: Record<string, any> = {};
    let totalCalls = 0;
    let totalErrors = 0;

    events.forEach(event => {
      if (event.eventType === 'claude_code.tool_use' && event.toolName) {
        const toolName = event.toolName;
        if (!toolStats[toolName]) {
          toolStats[toolName] = {
            calls: 0,
            errors: 0,
            totalDuration: 0,
            durations: []
          };
        }

        toolStats[toolName].calls++;
        totalCalls++;

        if (event.toolSuccess === false) {
          toolStats[toolName].errors++;
          totalErrors++;
        }

        if (event.toolDuration) {
          toolStats[toolName].totalDuration += event.toolDuration;
          toolStats[toolName].durations.push(event.toolDuration);
        }
      }
    });

    // Calculate averages
    const breakdown: Record<string, any> = {};
    Object.entries(toolStats).forEach(([toolName, stats]) => {
      breakdown[toolName] = {
        calls: stats.calls,
        errors: stats.errors,
        avgDuration: stats.durations.length > 0
          ? stats.totalDuration / stats.durations.length
          : 0,
        totalDuration: stats.totalDuration,
        errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0
      };
    });

    return {
      breakdown,
      errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
      successRate: totalCalls > 0 ? (totalCalls - totalErrors) / totalCalls : 1
    };
  }

  private aggregateCacheMetrics(events: OtelEvent[]) {
    let hits = 0;
    let misses = 0;

    events.forEach(event => {
      if (event.eventType === 'claude_code.cache_hit') {
        hits++;
      } else if (event.eventType === 'claude_code.cache_miss') {
        misses++;
      }
    });

    const total = hits + misses;
    return {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0
    };
  }
}
