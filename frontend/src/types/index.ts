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
  BACKLOG = 'backlog',
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  ARCHITECTURE = 'architecture',
  DESIGN = 'design',
  IMPLEMENTATION = 'implementation',
  REVIEW = 'review',
  QA = 'qa',
  DONE = 'done',
  BLOCKED = 'blocked',
}

export enum StoryType {
  FEATURE = 'feature',
  BUG = 'bug',
  DEFECT = 'defect',
  CHORE = 'chore',
  SPIKE = 'spike',
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
  layers?: Array<{
    layer: Layer;
  }>;
  components?: Array<{
    component: Component;
  }>;
  baAnalysis?: string;
  architectAnalysis?: string;
}

// Layer types
export enum LayerStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export interface Layer {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  techStack: string[];
  orderIndex: number;
  color?: string;
  icon?: string;
  status: LayerStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    storyLayers: number;
    componentLayers: number;
    useCases: number;
    testCases: number;
  };
}

// Component types
export enum ComponentStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  PLANNING = 'planning',
}

export interface Component {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  ownerId?: string;
  filePatterns: string[];
  color?: string;
  icon?: string;
  status: ComponentStatus;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  layers?: Array<{
    layer: {
      id: string;
      name: string;
      icon?: string;
      color?: string;
      orderIndex: number;
    };
  }>;
  _count?: {
    storyComponents: number;
    useCases: number;
    testCases: number;
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

export interface PlanningOverview {
  epics: Epic[];
  unassignedStories: Story[];
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

// Use Case types
export interface UseCaseVersion {
  id: string;
  version: number;
  summary?: string;
  content: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  linkedStoryId?: string;
  linkedDefectId?: string;
}

export interface UseCase {
  id: string;
  projectId: string;
  key: string;
  title: string;
  area?: string;
  componentId?: string;
  layerId?: string;
  createdAt: string;
  updatedAt: string;
  latestVersion?: UseCaseVersion;
  versions?: UseCaseVersion[];
  storyLinks?: {
    storyId: string;
    relation: string;
    story: {
      id: string;
      key: string;
      title: string;
      status: string;
    };
  }[];
  similarity?: number;  // For semantic search results
}

export interface CreateUseCaseDto {
  projectId: string;
  key: string;
  title: string;
  area?: string;
  content: string;
  summary?: string;
}

export interface UpdateUseCaseDto {
  title?: string;
  area?: string;
  content?: string;
  summary?: string;
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

// Test Case types
export enum TestLevel {
  unit = 'unit',
  integration = 'integration',
  e2e = 'e2e',
}

export enum TestPriority {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export enum TestCaseStatus {
  pending = 'pending',
  implemented = 'implemented',
  automated = 'automated',
  deprecated = 'deprecated',
}

export enum TestExecutionStatus {
  pass = 'pass',
  fail = 'fail',
  skip = 'skip',
  error = 'error',
}

export interface TestCase {
  id: string;
  projectId: string;
  useCaseId?: string;
  key: string;
  title: string;
  description?: string;
  testLevel: TestLevel;
  priority: TestPriority;
  status: TestCaseStatus;
  preconditions?: string;
  testSteps?: string;
  expectedResults?: string;
  testData?: string;
  testFilePath?: string;
  assignedToId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
  };
  useCase?: {
    id: string;
    key: string;
    title: string;
    area?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  latestExecution?: TestExecution;
  _count?: {
    executions: number;
  };
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  storyId?: string;
  commitHash?: string;
  executedAt: string;
  status: TestExecutionStatus;
  durationMs?: number;
  errorMessage?: string;
  coveragePercentage?: number;
  linesCovered?: number;
  linesTotal?: number;
  ciRunId?: string;
  environment?: string;
  testCase?: {
    id: string;
    key: string;
    title: string;
    testLevel: TestLevel;
  };
  story?: {
    id: string;
    key: string;
    title: string;
  };
  commit?: {
    hash: string;
    message: string;
    author: string;
  };
}

export interface CoverageStatistics {
  overall: number;
  byLevel: {
    unit: {
      coverage: number;
      testCount: number;
      implemented: number;
      pending: number;
    };
    integration: {
      coverage: number;
      testCount: number;
      implemented: number;
      pending: number;
    };
    e2e: {
      coverage: number;
      testCount: number;
      implemented: number;
      pending: number;
    };
  };
  totalTests: number;
  implementedTests: number;
  pendingTests: number;
  implementationRate: number;
}

export interface CoverageGap {
  level?: TestLevel;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface UseCaseCoverage {
  useCase: {
    id: string;
    key: string;
    title: string;
    area?: string;
    project?: {
      id: string;
      name: string;
    };
  };
  coverage: CoverageStatistics;
  testCases: (TestCase & { latestExecution?: TestExecution })[];
  coverageGaps: CoverageGap[];
}

export interface ComponentCoverage {
  component: string;
  coverage: CoverageStatistics;
  useCases: {
    useCase: {
      id: string;
      key: string;
      title: string;
    };
    coverage: CoverageStatistics;
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor' | 'not_covered';
  }[];
}

export interface TestExecutionStatistics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  errorCount: number;
  successRate: number;
  averageDuration: number;
  averageCoverage: number;
}

// Test Case DTOs
export interface CreateTestCaseDto {
  projectId: string;
  useCaseId?: string;
  key: string;
  title: string;
  description?: string;
  testLevel: TestLevel;
  priority: TestPriority;
  preconditions?: string;
  testSteps?: string;
  expectedResults?: string;
  testData?: string;
  testFilePath?: string;
  assignedToId?: string;
}

export interface UpdateTestCaseDto {
  title?: string;
  description?: string;
  testLevel?: TestLevel;
  priority?: TestPriority;
  status?: TestCaseStatus;
  preconditions?: string;
  testSteps?: string;
  expectedResults?: string;
  testData?: string;
  testFilePath?: string;
  assignedToId?: string;
}

export interface SearchTestCaseDto {
  projectId?: string;
  useCaseId?: string;
  testLevel?: TestLevel;
  priority?: TestPriority;
  status?: TestCaseStatus;
  query?: string;
  assignedToId?: string;
  page?: number;
  limit?: number;
}

export interface ReportTestExecutionDto {
  testCaseId: string;
  storyId?: string;
  commitHash?: string;
  status: TestExecutionStatus;
  durationMs?: number;
  errorMessage?: string;
  coveragePercentage?: number;
  linesCovered?: number;
  linesTotal?: number;
  ciRunId?: string;
  environment?: string;
}
