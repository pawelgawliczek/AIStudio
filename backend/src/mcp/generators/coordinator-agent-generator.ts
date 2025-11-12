import { CoordinatorAgent } from '@prisma/client';

export interface CoordinatorWithComponents extends CoordinatorAgent {
  componentIds: string[];
  components?: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
  }>;
}

export class CoordinatorAgentGenerator {
  /**
   * Generate a coordinator agent file in Claude Code format
   * @param coordinator - The coordinator agent with its components
   * @param workflowName - The workflow name for file naming
   * @returns Object with filename and content
   */
  static generate(
    coordinator: CoordinatorWithComponents,
    workflowName: string,
  ): { filename: string; content: string } {
    const sanitizedName = this.sanitizeFilename(workflowName);
    const filename = `.claude/agents/coordinator-${sanitizedName}.md`;

    const content = this.generateContent(coordinator);

    return { filename, content };
  }

  private static generateContent(coordinator: CoordinatorWithComponents): string {
    const frontmatter = this.generateFrontmatter(coordinator);
    const body = this.generateBody(coordinator);

    return `${frontmatter}\n\n${body}`;
  }

  private static generateFrontmatter(coordinator: CoordinatorWithComponents): string {
    const tools = coordinator.tools || [
      'invoke_component',
      'get_workflow_state',
      'create_subtask',
    ];

    return `---
name: ${coordinator.name}
description: ${coordinator.description}
domain: ${coordinator.domain}
tools:
${tools.map((tool) => `  - ${tool}`).join('\n')}
---`;
  }

  private static generateBody(coordinator: CoordinatorWithComponents): string {
    const sections = [];

    // Overview section
    sections.push(`# Coordinator: ${coordinator.name}`);
    sections.push('');
    sections.push('## Overview');
    sections.push(coordinator.description);
    sections.push('');

    // Decision Strategy section
    sections.push('## Decision Strategy');
    sections.push(coordinator.decisionStrategy || 'Sequential execution');
    sections.push('');

    // Available Components section
    if (coordinator.components && coordinator.components.length > 0) {
      sections.push('## Available Components');
      sections.push('');
      coordinator.components.forEach((component) => {
        sections.push(`### ${component.name}`);
        sections.push(component.description || 'No description');
        if (component.tags.length > 0) {
          sections.push(`**Tags**: ${component.tags.join(', ')}`);
        }
        sections.push('');
      });
    }

    // Instructions section
    sections.push('## Coordinator Instructions');
    sections.push('');
    sections.push(coordinator.coordinatorInstructions);
    sections.push('');

    // Configuration section
    if (coordinator.config && Object.keys(coordinator.config).length > 0) {
      sections.push('## Configuration');
      sections.push('');
      sections.push('```json');
      sections.push(JSON.stringify(coordinator.config, null, 2));
      sections.push('```');
      sections.push('');
    }

    // Component IDs reference
    sections.push('## Component References');
    sections.push('');
    sections.push('**Component IDs**:');
    coordinator.componentIds.forEach((id, index) => {
      const componentName = coordinator.components?.[index]?.name || 'Unknown';
      sections.push(`- ${componentName}: \`${id}\``);
    });

    return sections.join('\n');
  }

  private static sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
