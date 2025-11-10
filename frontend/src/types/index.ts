// User types
export enum UserRole {
  admin = 'admin',
  pm = 'pm',
  ba = 'ba',
  architect = 'architect',
  dev = 'dev',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    epics: number;
    stories: number;
  };
}

// Epic types
export enum EpicStatus {
  planning = 'planning',
  in_progress = 'in_progress',
  completed = 'completed',
  on_hold = 'on_hold',
}

export interface Epic {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description?: string;
  priority: number;
  status: EpicStatus;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  _count?: {
    stories: number;
    commits: number;
  };
  stories?: Story[];
}

// Story types
export enum StoryStatus {
  planning = 'planning',
  analysis = 'analysis',
  architecture = 'architecture',
  design = 'design',
  implementation = 'implementation',
  review = 'review',
  qa = 'qa',
  done = 'done',
}

export enum StoryType {
  feature = 'feature',
  bug = 'bug',
  tech_debt = 'tech_debt',
  spike = 'spike',
}

export interface Story {
  id: string;
  key: string;
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  status: StoryStatus;
  type: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
  assignedFrameworkId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  epic?: {
    id: string;
    key: string;
    title: string;
  };
  assignedFramework?: {
    id: string;
    name: string;
  };
  subtasks?: Subtask[];
  _count?: {
    subtasks: number;
    commits: number;
    runs: number;
  };
}

// Subtask types
export enum SubtaskStatus {
  todo = 'todo',
  in_progress = 'in_progress',
  review = 'review',
  done = 'done',
}

export enum SubtaskLayer {
  frontend = 'frontend',
  backend = 'backend',
  tests = 'tests',
  docs = 'docs',
  infra = 'infra',
}

export enum AssigneeType {
  agent = 'agent',
  human = 'human',
}

export interface Subtask {
  id: string;
  storyId: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  layer?: SubtaskLayer;
  component?: string;
  assigneeType?: AssigneeType;
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
  story?: {
    id: string;
    key: string;
    title: string;
    projectId?: string;
  };
}

// DTOs for API requests
export interface CreateStoryDto {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  type?: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
}

export interface UpdateStoryDto {
  epicId?: string;
  title?: string;
  description?: string;
  type?: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
  assignedFrameworkId?: string;
}

export interface UpdateStoryStatusDto {
  status: StoryStatus;
}

export interface FilterStoryDto {
  projectId?: string;
  epicId?: string;
  status?: StoryStatus;
  type?: StoryType;
  assignedFrameworkId?: string;
  search?: string;
  minTechnicalComplexity?: number;
  maxTechnicalComplexity?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateEpicDto {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
}

export interface UpdateEpicDto {
  title?: string;
  description?: string;
  priority?: number;
  status?: EpicStatus;
}

export interface FilterEpicDto {
  projectId?: string;
  status?: EpicStatus;
}

export interface CreateSubtaskDto {
  storyId: string;
  title: string;
  description?: string;
  layer?: SubtaskLayer;
  component?: string;
  assigneeType?: AssigneeType;
  assignedAgentId?: string;
}

export interface UpdateSubtaskDto {
  title?: string;
  description?: string;
  status?: SubtaskStatus;
  layer?: SubtaskLayer;
  component?: string;
  assigneeType?: AssigneeType;
  assignedAgentId?: string;
}

export interface FilterSubtaskDto {
  storyId?: string;
  status?: SubtaskStatus;
  layer?: SubtaskLayer;
  assigneeType?: AssigneeType;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// WebSocket event types
export interface WebSocketMessage {
  event: string;
  data: any;
}

export interface StoryCreatedEvent {
  story: Story;
}

export interface StoryUpdatedEvent {
  story: Story;
}

export interface StoryStatusChangedEvent {
  storyId: string;
  oldStatus: StoryStatus;
  newStatus: StoryStatus;
  story: Story;
}

export interface EpicCreatedEvent {
  epic: Epic;
}

export interface EpicUpdatedEvent {
  epic: Epic;
}

export interface SubtaskCreatedEvent {
  subtask: Subtask;
}

export interface SubtaskUpdatedEvent {
  subtask: Subtask;
}

export interface UserJoinedEvent {
  userId: string;
  userName: string;
}

export interface UserLeftEvent {
  userId: string;
}

export interface TypingEvent {
  userId: string;
  userName: string;
  entityId: string;
  entityType: string;
}
