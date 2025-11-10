// Shared constants

export const API_VERSION = '1.0.0';

export const DEFAULT_PAGE_SIZE = 20;

export const TOKEN_EXPIRY_DAYS = 7;

// Story workflow transitions
export const STORY_WORKFLOW = {
  planning: ['analysis', 'architecture'],
  analysis: ['planning', 'architecture'],
  architecture: ['analysis', 'design'],
  design: ['architecture', 'impl'],
  impl: ['design', 'review'],
  review: ['impl', 'qa'],
  qa: ['review', 'impl', 'done'],
  done: [],
} as const;

// Complexity bands for metrics normalization
export const COMPLEXITY_BANDS = {
  LOW: { min: 0, max: 10 },
  MEDIUM: { min: 11, max: 50 },
  HIGH: { min: 51, max: 100 },
  VERY_HIGH: { min: 101, max: Infinity },
} as const;
