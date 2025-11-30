import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ST-150: Stream Event Service
 *
 * Stores and retrieves streaming events from Claude Code agent execution.
 * Events are stored for observability and replay (crash recovery).
 */
@Injectable()
export class StreamEventService {
  private readonly logger = new Logger(StreamEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Store a streaming event from agent execution
   */
  async storeEvent(
    componentRunId: string,
    workflowRunId: string,
    eventType: string,
    sequenceNumber: number,
    timestamp: Date,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.agentStreamEvent.create({
        data: {
          componentRunId,
          workflowRunId,
          eventType,
          sequenceNumber,
          timestamp,
          payload: payload as any, // Cast to any to satisfy Prisma JSON type
        },
      });
    } catch (error: any) {
      // Log but don't throw - streaming events are observability, not critical path
      this.logger.error(`Failed to store stream event: ${error.message}`);
    }
  }

  /**
   * Get events for a component run (for replay/debugging)
   */
  async getEventsForComponentRun(
    componentRunId: string,
    options?: {
      eventType?: string;
      afterSequence?: number;
      limit?: number;
    },
  ): Promise<any[]> {
    return this.prisma.agentStreamEvent.findMany({
      where: {
        componentRunId,
        ...(options?.eventType && { eventType: options.eventType }),
        ...(options?.afterSequence !== undefined && {
          sequenceNumber: { gt: options.afterSequence },
        }),
      },
      orderBy: { sequenceNumber: 'asc' },
      take: options?.limit || 1000,
    });
  }

  /**
   * Get events for a workflow run (aggregate view)
   */
  async getEventsForWorkflowRun(
    workflowRunId: string,
    options?: {
      eventType?: string;
      limit?: number;
    },
  ): Promise<any[]> {
    return this.prisma.agentStreamEvent.findMany({
      where: {
        workflowRunId,
        ...(options?.eventType && { eventType: options.eventType }),
      },
      orderBy: [{ componentRunId: 'asc' }, { sequenceNumber: 'asc' }],
      take: options?.limit || 5000,
    });
  }

  /**
   * Get latest event for a component run (for resume detection)
   */
  async getLatestEvent(componentRunId: string): Promise<any | null> {
    return this.prisma.agentStreamEvent.findFirst({
      where: { componentRunId },
      orderBy: { sequenceNumber: 'desc' },
    });
  }

  /**
   * Count events by type for a component run
   */
  async getEventCounts(
    componentRunId: string,
  ): Promise<Record<string, number>> {
    const events = await this.prisma.agentStreamEvent.groupBy({
      by: ['eventType'],
      where: { componentRunId },
      _count: { id: true },
    });

    return events.reduce(
      (acc, e) => {
        acc[e.eventType] = e._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Get token metrics from stream_end events
   */
  async getTokenMetrics(componentRunId: string): Promise<{
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
  } | null> {
    const streamEnd = await this.prisma.agentStreamEvent.findFirst({
      where: {
        componentRunId,
        eventType: 'stream_end',
      },
      orderBy: { sequenceNumber: 'desc' },
    });

    if (!streamEnd) return null;

    const payload = streamEnd.payload as Record<string, unknown>;
    const metrics = payload.metrics as Record<string, number> | undefined;

    if (!metrics) return null;

    return {
      inputTokens: metrics.inputTokens || 0,
      outputTokens: metrics.outputTokens || 0,
      cacheCreationTokens: metrics.cacheCreationTokens || 0,
      cacheReadTokens: metrics.cacheReadTokens || 0,
      totalTokens: metrics.totalTokens || 0,
    };
  }

  /**
   * Delete old events (cleanup job)
   * Keeps events for 30 days by default
   */
  async cleanupOldEvents(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.agentStreamEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old stream events`);
    return result.count;
  }
}
