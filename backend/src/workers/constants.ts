/**
 * Queue names as constants for consistency
 */
export const QUEUE_NAMES = {
  CODE_ANALYSIS: 'code-analysis',
  EMBEDDING: 'embedding',
  METRICS_AGGREGATION: 'metrics-aggregation',
  NOTIFICATION: 'notification',
  TEST_ANALYSIS: 'test-analysis',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
