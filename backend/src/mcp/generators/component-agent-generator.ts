import { Component } from '@prisma/client';

export class ComponentAgentGenerator {
  /**
   * Generate a component agent file in Claude Code format
   * @param component - The component to generate an agent file for
   * @returns Object with filename and content
   */
  static generate(component: Component): { filename: string; content: string } {
    const sanitizedName = this.sanitizeFilename(component.name);
    const filename = `.claude/agents/component-${sanitizedName}.md`;

    const content = this.generateContent(component);

    return { filename, content };
  }

  private static generateContent(component: Component): string {
    const frontmatter = this.generateFrontmatter(component);
    const body = this.generateBody(component);

    return `${frontmatter}\n\n${body}`;
  }

  private static generateFrontmatter(component: Component): string {
    const tools = component.tools || [];
    const tags = component.tags || [];

    return `---
name: ${component.name}
description: ${component.description || 'No description'}
tags: [${tags.join(', ')}]
tools:
${tools.map((tool) => `  - ${tool}`).join('\n')}
---`;
  }

  private static generateBody(component: Component): string {
    const sections = [];

    // Header
    sections.push(`# Component: ${component.name}`);
    sections.push('');

    // Description
    if (component.description) {
      sections.push('## Description');
      sections.push(component.description);
      sections.push('');
    }

    // Input Instructions
    sections.push('## Input Instructions');
    sections.push('');
    sections.push(component.inputInstructions || 'No input instructions defined');
    sections.push('');

    // Operation Instructions
    sections.push('## Operation Instructions');
    sections.push('');
    sections.push(component.operationInstructions || 'No operation instructions defined');
    sections.push('');

    // Output Instructions
    sections.push('## Output Instructions');
    sections.push('');
    sections.push(component.outputInstructions || 'No output instructions defined');
    sections.push('');

    // Configuration
    if (component.config && Object.keys(component.config).length > 0) {
      sections.push('## Configuration');
      sections.push('');
      sections.push('```json');
      sections.push(JSON.stringify(component.config, null, 2));
      sections.push('```');
      sections.push('');
    }

    // Subtask Configuration
    if (component.subtaskConfig && Object.keys(component.subtaskConfig).length > 0) {
      sections.push('## Subtask Configuration');
      sections.push('');
      sections.push('```json');
      sections.push(JSON.stringify(component.subtaskConfig, null, 2));
      sections.push('```');
      sections.push('');
    }

    // On Failure Strategy
    sections.push('## On Failure');
    sections.push('');
    sections.push(`**Strategy**: ${component.onFailure || 'abort'}`);
    sections.push('');

    // Metadata
    sections.push('## Metadata');
    sections.push('');
    sections.push(`- **Component ID**: \`${component.id}\``);
    sections.push(`- **Active**: ${component.active ? 'Yes' : 'No'}`);
    sections.push(`- **Created**: ${component.createdAt.toISOString()}`);
    sections.push(`- **Updated**: ${component.updatedAt.toISOString()}`);

    return sections.join('\n');
  }

  private static sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
