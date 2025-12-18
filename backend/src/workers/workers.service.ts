import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { QUEUE_NAMES } from './constants';

/**
 * Service for enqueueing background jobs
 */
@Injectable()
export class WorkersService {
  constructor(
    @InjectQueue(QUEUE_NAMES.CODE_ANALYSIS)
    private codeAnalysisQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMBEDDING)
    private embeddingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.METRICS_AGGREGATION)
    private metricsAggregationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TEST_ANALYSIS)
    private testAnalysisQueue: Queue,
  ) {}

  /**
   * Enqueue code analysis job for a commit
   */
  async analyzeCommit(data: {
    commitHash: string;
    projectId: string;
    storyId?: string;
  }) {
    return this.codeAnalysisQueue.add('analyze-commit', data, {
      priority: 2, // Normal priority
    });
  }

  /**
   * Enqueue code analysis for entire project (initial scan)
   */
  async analyzeProject(projectId: string) {
    return this.codeAnalysisQueue.add('analyze-project', { projectId }, {
      priority: 3, // Lower priority for bulk operations
    });
  }

  /**
   * Generate embeddings for a use case
   */
  async generateEmbedding(data: {
    useCaseId: string;
    content: string;
  }) {
    return this.embeddingQueue.add('generate-embedding', data, {
      priority: 2,
    });
  }

  /**
   * Regenerate embeddings for all use cases (maintenance)
   */
  async regenerateAllEmbeddings(projectId: string) {
    return this.embeddingQueue.add('regenerate-all', { projectId }, {
      priority: 3,
    });
  }

  /**
   * Aggregate metrics for a story
   */
  async aggregateStoryMetrics(storyId: string) {
    return this.metricsAggregationQueue.add('aggregate-story', { storyId }, {
      priority: 2,
    });
  }

  /**
   * Aggregate metrics for framework comparison (scheduled)
   */
  async aggregateFrameworkMetrics(projectId: string) {
    return this.metricsAggregationQueue.add(
      'aggregate-framework',
      { projectId },
      {
        priority: 2,
      },
    );
  }

  /**
   * Send notification
   */
  async sendNotification(data: {
    type: 'email' | 'websocket' | 'in-app';
    recipients: string[];
    subject?: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    return this.notificationQueue.add('send-notification', data, {
      priority: 1, // High priority for notifications
    });
  }

  /**
   * Analyze test results from CI/CD
   */
  async analyzeTestResults(data: {
    projectId: string;
    storyId?: string;
    testResults: Record<string, unknown>;
    coverageReport?: Record<string, unknown>;
  }) {
    return this.testAnalysisQueue.add('analyze-tests', data, {
      priority: 2,
    });
  }

  /**
   * Calculate test coverage gaps
   */
  async calculateCoverageGaps(projectId: string) {
    return this.testAnalysisQueue.add('coverage-gaps', { projectId }, {
      priority: 3,
    });
  }
}
