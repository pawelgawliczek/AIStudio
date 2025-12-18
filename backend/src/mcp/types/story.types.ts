/**
 * Story Management Type Definitions
 */

import { PaginationParams } from './common.types';

export interface CreateStoryParams {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  summary?: string; // AI-generated 2-sentence summary (max 300 chars)
  type?: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  assignedFrameworkId?: string;
}

export interface ListStoriesParams extends PaginationParams {
  projectId?: string;
  epicId?: string;
  status?: 'planning' | 'analysis' | 'architecture' | 'design' | 'impl' | 'review' | 'qa' | 'done';
  type?: 'feature' | 'bug' | 'defect' | 'chore' | 'spike';
  query?: string; // Text search across title, key, description (case-insensitive)
  includeSubtasks?: boolean; // Include subtasks in response
  includeUseCases?: boolean; // Include linked use cases in response
  includeCommits?: boolean; // Include linked commits in response (max 10 per story)
  fields?: string[]; // Specific fields to return for token efficiency
}

export interface GetStoryParams {
  storyId: string;
  includeSubtasks?: boolean;
  includeUseCases?: boolean;
  includeCommits?: boolean;
  responseMode?: 'minimal' | 'standard' | 'full'; // Token efficiency: minimal=key fields, standard=all, full=with relations
}

export interface UpdateStoryParams {
  storyId: string;
  title?: string;
  description?: string;
  summary?: string; // AI-generated 2-sentence summary (max 300 chars)
  status?: 'planning' | 'analysis' | 'architecture' | 'design' | 'impl' | 'review' | 'qa' | 'done';
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  assignedFrameworkId?: string;
  contextExploration?: string;
  baAnalysis?: string;
  designerAnalysis?: string;
  architectAnalysis?: string;
}

export interface DeleteStoryParams {
  storyId: string;
  confirm: boolean;
}

export interface DeleteStoryResponse {
  id: string;
  key: string;
  title: string;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    storyFiles: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
}

export interface StoryResponse {
  id: string;
  projectId: string;
  epicId?: string;
  key: string;
  type: string;
  title: string;
  summary?: string | null; // Token-efficient 2-sentence summary (max 300 chars)
  description?: string;
  status: string;
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  estimatedTokenCost?: number;
  assignedFrameworkId?: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: SubtaskResponse[];
  useCases?: UseCaseResponse[];
  commits?: CommitResponse[];
}

export interface SubtaskResponse {
  id: string;
  storyId: string;
  key?: string;
  title: string;
  description?: string;
  layer?: string;
  component?: string;
  assigneeType: string;
  assigneeId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseCaseResponse {
  id: string;
  projectId: string;
  key: string;
  title: string;
  area?: string;
  latestVersion?: {
    version: number;
    summary?: string;
    content: string;
  };
}

export interface CommitResponse {
  hash: string;
  author: string;
  timestamp: string;
  message: string;
  files?: {
    filePath: string;
    locAdded: number;
    locDeleted: number;
  }[];
}
