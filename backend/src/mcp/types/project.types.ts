/**
 * Project Management Type Definitions
 */

import { PaginationParams } from './common.types';

export interface BootstrapProjectParams {
  name: string;
  description?: string;
  repositoryUrl?: string;
  defaultFramework?: string;
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  repositoryUrl?: string;
}

export interface ListProjectsParams extends PaginationParams {
  status?: 'active' | 'archived';
}

export interface GetProjectParams {
  projectId: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  epicCount?: number;
  storyCount?: number;
}
