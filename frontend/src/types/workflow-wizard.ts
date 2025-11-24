/**
 * Types for Workflow Creation Wizard (ST-90)
 */

export interface ComponentAssignment {
  componentName: string;
  componentId: string;
  versionId: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
}

export interface TriggerConfig {
  type: 'manual' | 'story_status_change' | 'scheduled' | 'webhook';
  conditions?: Record<string, any>;
  schedule?: {
    cron?: string;
    timezone?: string;
  };
}

export interface WizardState {
  // Step 1: Workflow Shell
  name: string;
  description: string;
  projectId: string;

  // Step 2: Component Assignments
  componentAssignments: ComponentAssignment[];

  // Step 3: Coordinator Selection
  coordinatorMode: 'existing' | 'new';
  coordinatorId?: string; // For existing coordinator

  // For new coordinator
  newCoordinator?: {
    name: string;
    instructions: string;
    modelId: string;
    temperature: number;
    decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    maxRetries: number;
    timeout: number;
    costLimit: number;
  };

  // Workflow settings
  triggerConfig: TriggerConfig;
  active: boolean;
}

export interface TemplateReference {
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateValidationError {
  reference: string;
  message: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateValidationResult {
  valid: boolean;
  references: TemplateReference[];
  errors: TemplateValidationError[];
  missingComponents: string[];
}

export interface ComponentVersion {
  id: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  createdAt: string;
  changeDescription?: string;
}

export interface Component {
  id: string;
  name: string;
  description?: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
  tags: string[];
}

export interface Coordinator {
  id: string;
  name: string;
  description?: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
  operationInstructions: string;
  config: {
    modelId: string;
    temperature: number;
    decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
    maxRetries?: number;
    timeout?: number;
    costLimit?: number;
  };
}

export type WizardStep = 1 | 2 | 3;
