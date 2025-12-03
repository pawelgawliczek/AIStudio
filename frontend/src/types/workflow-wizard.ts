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

  // Workflow settings (ST-164: Coordinator selection removed)
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

// Coordinator type removed - workflows no longer use coordinators (ST-164)

export type WizardStep = 1 | 2;
