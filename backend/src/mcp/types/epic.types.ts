/**
 * Epic Management Type Definitions
 */

import { PaginationParams } from './common.types';

export interface CreateEpicParams {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
}

export interface ListEpicsParams extends PaginationParams {
  projectId: string;
  status?: 'planning' | 'in_progress' | 'done' | 'archived';
  fields?: string[]; // Specific fields to return for token efficiency
}

export interface DeleteEpicParams {
  epicId: string;
  confirm: boolean;
  deleteStories?: boolean;
}

export interface DeleteEpicResponse {
  id: string;
  key: string;
  title: string;
  storiesDeleted: number;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
}

export interface EpicResponse {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  storyCount?: number;
}
