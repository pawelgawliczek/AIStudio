// Shared type definitions

export enum UserRole {
  ADMIN = 'admin',
  PM = 'pm',
  BA = 'ba',
  ARCHITECT = 'architect',
  DEV = 'dev',
  QA = 'qa',
  VIEWER = 'viewer',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum StoryStatus {
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  ARCHITECTURE = 'architecture',
  DESIGN = 'design',
  IMPL = 'impl',
  REVIEW = 'review',
  QA = 'qa',
  DONE = 'done',
}

export enum StoryType {
  FEATURE = 'feature',
  BUG = 'bug',
  DEFECT = 'defect',
  CHORE = 'chore',
  SPIKE = 'spike',
}

export enum LayerType {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  INFRA = 'infra',
  TEST = 'test',
  OTHER = 'other',
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Story {
  id: string;
  projectId: string;
  epicId?: string;
  key: string;
  type: StoryType;
  title: string;
  description?: string;
  status: StoryStatus;
  businessImpact?: number;
  businessComplexity?: number;
  technicalComplexity?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
