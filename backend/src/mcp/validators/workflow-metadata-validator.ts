import { ValidationError } from './agent-file-validator';

export interface WorkflowMetadata {
  workflowId: string;
  coordinatorId: string;
  componentIds: string[];
  version: string;
}

export class WorkflowMetadataValidator {
  /**
   * Validate workflow metadata against database records
   */
  static async validate(
    metadata: WorkflowMetadata,
    dbWorkflow: any,
    dbCoordinator: any,
    dbComponents: any[],
  ): Promise<{ valid: boolean; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];

    // Validate workflow ID matches
    if (metadata.workflowId !== dbWorkflow.id) {
      errors.push({
        file: 'workflow-metadata',
        error: `Workflow ID mismatch: expected ${dbWorkflow.id}, got ${metadata.workflowId}`,
        severity: 'error',
      });
    }

    // Validate coordinator ID matches
    if (metadata.coordinatorId !== dbCoordinator.id) {
      errors.push({
        file: 'workflow-metadata',
        error: `Coordinator ID mismatch: expected ${dbCoordinator.id}, got ${metadata.coordinatorId}`,
        severity: 'error',
      });
    }

    // Validate all component IDs exist
    const dbComponentIds = new Set(dbComponents.map((c) => c.id));
    for (const componentId of metadata.componentIds) {
      if (!dbComponentIds.has(componentId)) {
        errors.push({
          file: 'workflow-metadata',
          error: `Component ID not found in database: ${componentId}`,
          severity: 'error',
        });
      }
    }

    // Validate version format
    if (!/^v\d+\.\d+$/.test(metadata.version)) {
      errors.push({
        file: 'workflow-metadata',
        error: `Invalid version format: ${metadata.version} (should be v1.0, v2.1, etc.)`,
        severity: 'error',
      });
    }

    // Validate workflow is active
    if (!dbWorkflow.active) {
      errors.push({
        file: 'workflow-metadata',
        error: 'Workflow is not active in database',
        severity: 'warning',
      });
    }

    // Validate coordinator is active
    if (!dbCoordinator.active) {
      errors.push({
        file: 'workflow-metadata',
        error: 'Coordinator is not active in database',
        severity: 'warning',
      });
    }

    // Validate all components are active
    for (const component of dbComponents) {
      if (!component.active) {
        errors.push({
          file: 'workflow-metadata',
          error: `Component ${component.name} is not active in database`,
          severity: 'warning',
        });
      }
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
    };
  }

  /**
   * Validate that workflow has all required data for activation
   */
  static validateWorkflowComplete(workflow: any): {
    valid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    if (!workflow) {
      errors.push({
        file: 'workflow',
        error: 'Workflow not found',
        severity: 'error',
      });
      return { valid: false, errors };
    }

    // ST-164: Coordinators are deprecated, check for components instead
    if (!workflow.components || workflow.components.length === 0) {
      errors.push({
        file: 'workflow',
        error: 'Workflow has no components assigned',
        severity: 'error',
      });
    }

    if (!workflow.name || workflow.name.trim() === '') {
      errors.push({
        file: 'workflow',
        error: 'Workflow name is empty',
        severity: 'error',
      });
    }

    if (!workflow.active) {
      errors.push({
        file: 'workflow',
        error: 'Workflow is not active',
        severity: 'error',
      });
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
    };
  }
}
