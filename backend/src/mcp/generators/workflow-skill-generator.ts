import { Workflow } from '@prisma/client';

export interface WorkflowWithRelations extends Workflow {
  // ST-164: Coordinators are deprecated, this field is optional for backwards compatibility
  coordinator?: {
    id: string;
    name: string;
    description: string;
  };
  components?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export class WorkflowSkillGenerator {
  /**
   * Generate a workflow skill file in Claude Code format
   * @param workflow - The workflow with coordinator and components
   * @param activatedAt - Timestamp when workflow was activated
   * @returns Object with filename and content
   */
  static generate(
    workflow: WorkflowWithRelations,
    activatedAt: Date,
  ): { filename: string; content: string } {
    const sanitizedName = this.sanitizeFilename(workflow.name);
    const filename = `.claude/skills/workflow-${sanitizedName}.md`;

    const content = this.generateContent(workflow, activatedAt);

    return { filename, content };
  }

  private static generateContent(
    workflow: WorkflowWithRelations,
    activatedAt: Date,
  ): string {
    const frontmatter = this.generateFrontmatter(workflow);
    const body = this.generateBody(workflow, activatedAt);

    return `${frontmatter}\n\n${body}`;
  }

  private static generateFrontmatter(workflow: WorkflowWithRelations): string {
    return `---
name: ${workflow.name}
description: ${workflow.description || 'No description'}
trigger: ${JSON.stringify(workflow.triggerConfig || {})}
version: ${workflow.version}
---`;
  }

  private static generateBody(
    workflow: WorkflowWithRelations,
    activatedAt: Date,
  ): string {
    const sections = [];

    // Header
    sections.push(`# Workflow: ${workflow.name}`);
    sections.push('');

    // Description
    sections.push('## Description');
    sections.push(workflow.description || 'No description');
    sections.push('');

    // Coordinator (deprecated ST-164)
    if (workflow.coordinator) {
      sections.push('## Coordinator');
      sections.push('');
      sections.push(`**Uses**: ${workflow.coordinator.name}`);
      sections.push('');
      sections.push(workflow.coordinator.description);
      sections.push('');
    }

    // Components
    if (workflow.components && workflow.components.length > 0) {
      sections.push('## Components');
      sections.push('');
      workflow.components.forEach((component) => {
        sections.push(`- **${component.name}**: ${component.description || 'No description'}`);
      });
      sections.push('');
    }

    // Trigger Configuration
    sections.push('## Trigger Configuration');
    sections.push('');
    if (workflow.triggerConfig && Object.keys(workflow.triggerConfig).length > 0) {
      sections.push('```json');
      sections.push(JSON.stringify(workflow.triggerConfig, null, 2));
      sections.push('```');
      sections.push('');
      sections.push(this.generateTriggerDescription(workflow.triggerConfig));
    } else {
      sections.push('No trigger configuration defined (manual execution only)');
    }
    sections.push('');

    // Usage
    sections.push('## Usage');
    sections.push('');
    sections.push('To use this workflow:');
    sections.push('');
    if (workflow.coordinator) {
      sections.push(`1. The coordinator agent **${workflow.coordinator.name}** will orchestrate the workflow`);
      sections.push('2. Components will be invoked as determined by the coordinator');
    } else {
      sections.push('1. Workflow states will be executed sequentially');
      sections.push('2. Components will be invoked as defined in workflow states');
    }
    sections.push('3. Results will be tracked and stored for analysis');
    sections.push('');

    // Metadata
    sections.push('## Metadata');
    sections.push('');
    sections.push(`- **Workflow ID**: \`${workflow.id}\``);
    sections.push(`- **Version**: ${workflow.version}`);
    sections.push(`- **Activated**: ${activatedAt.toISOString()}`);
    sections.push(`- **Active**: ${workflow.active ? 'Yes' : 'No'}`);

    return sections.join('\n');
  }

  private static generateTriggerDescription(triggerConfig: any): string {
    if (!triggerConfig || typeof triggerConfig !== 'object') {
      return 'This workflow is triggered manually.';
    }

    const { type, condition } = triggerConfig;

    switch (type) {
      case 'story_status_change':
        return `This workflow is triggered when a story status changes to: **${condition || 'any'}**`;
      case 'manual':
        return 'This workflow is triggered manually by the user.';
      case 'scheduled':
        return `This workflow runs on a schedule: **${condition || 'not specified'}**`;
      case 'webhook':
        return 'This workflow is triggered by a webhook event.';
      default:
        return `This workflow is triggered by: **${type || 'unknown'}**`;
    }
  }

  private static sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
