import { Component } from '@prisma/client';

export interface CoordinatorWithComponents extends Component {
  components?: Array<{
    id: string;
    name: string;
    description: string | null;
    tags: string[];
  }>;
  // Legacy fields for backward compatibility
  domain?: string;
  decisionStrategy?: string;
  coordinatorInstructions?: string;
  componentIds?: string[];
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
    // Always include execution tracking MCP tools
    const executionTools = [
      'start_workflow_run',
      'record_component_start',
      'record_component_complete',
      'get_workflow_context',
      'update_workflow_status',
      'store_artifact',
    ];

    const customTools = coordinator.tools || [];
    const allTools = [...executionTools, ...customTools];

    // Extract domain from tags or use default
    const domain = coordinator.domain || coordinator.tags.find(tag => !['coordinator', 'orchestrator'].includes(tag)) || 'software-development';

    return `---
name: ${coordinator.name}
description: ${coordinator.description || 'Workflow coordinator'}
domain: ${domain}
tools:
${allTools.map((tool) => `  - ${tool}`).join('\n')}
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

    // Workflow Execution Protocol - CRITICAL!
    sections.push('## Workflow Execution Protocol');
    sections.push('');
    sections.push('**IMPORTANT**: When executing this workflow, you MUST follow this protocol using MCP tools to track execution state.');
    sections.push('');

    sections.push('### Step 1: Initialize Workflow Run');
    sections.push('');
    sections.push('When the user requests to execute this workflow, call `start_workflow_run`:');
    sections.push('');
    sections.push('```json');
    sections.push('{');
    sections.push(`  "workflowId": "INSERT_WORKFLOW_ID_HERE",`);
    sections.push('  "triggeredBy": "user-{userId}",');
    sections.push('  "context": {');
    sections.push('    // Extract context from user request');
    sections.push('    // Examples: prNumber, storyId, branch, issueId, etc.');
    sections.push('  }');
    sections.push('}');
    sections.push('```');
    sections.push('');
    sections.push('Store the returned `runId` for all subsequent MCP calls.');
    sections.push('');

    sections.push('### Step 2: Execute Components');
    sections.push('');
    sections.push('For each component you decide to execute:');
    sections.push('');
    sections.push('**2.1. Start Component**');
    sections.push('```json');
    sections.push('{');
    sections.push('  "runId": "{runId from step 1}",');
    sections.push('  "componentId": "{component ID}",');
    sections.push('  "input": {');
    sections.push('    // Component input data');
    sections.push('  }');
    sections.push('}');
    sections.push('```');
    sections.push('');

    sections.push('**2.2. Execute Component Logic with Reference-Based Architecture**');
    sections.push('');
    sections.push('**CRITICAL: Use Reference-Based Spawning Pattern**');
    sections.push('');
    sections.push('When spawning component agents with the Task tool, use MINIMAL context with component ID reference:');
    sections.push('');
    sections.push('```markdown');
    sections.push('Execute {Component Name} component for story {Story Key}.');
    sections.push('');
    sections.push('**CRITICAL FIRST STEP: Retrieve your work instructions**');
    sections.push('');
    sections.push('const instructions = await get_component_instructions({');
    sections.push('  componentId: "{componentId from remainingComponents}"');
    sections.push('});');
    sections.push('');
    sections.push('**NO FILE RE-EXPLORATION!**');
    sections.push('');
    sections.push('You MUST:');
    sections.push('1. Call get_component_instructions to retrieve your instructions');
    sections.push('2. Read from Story database fields (contextExploration, baAnalysis, architectAnalysis)');
    sections.push('   - DO NOT explore files directly (Context Explore already did this)');
    sections.push('   - DO NOT use Glob/Grep/Read on application code');
    sections.push('');
    sections.push('3. Follow the retrieved instructions exactly:');
    sections.push('   - Input Instructions: How to gather data');
    sections.push('   - Operation Instructions: What work to do');
    sections.push('   - Output Instructions: How to format results');
    sections.push('');
    sections.push('4. Save your analysis to appropriate Story field via update_story');
    sections.push('');
    sections.push('5. Call record_component_complete when done');
    sections.push('');
    sections.push('**Context:**');
    sections.push('- Story ID: {storyId}');
    sections.push('- Project ID: {projectId}');
    sections.push('- Run ID: {runId}');
    sections.push('- Component Run ID: [provided by system]');
    sections.push('');
    sections.push('**Return Format:** Use standard markdown format (Status, Summary, Recommendation, Key Outputs, Next Steps)');
    sections.push('```');
    sections.push('');
    sections.push('**Key Advantages of Reference-Based Architecture:**');
    sections.push('- 95% token reduction in coordinator context (60KB → 3KB)');
    sections.push('- No more truncation in get_workflow_context');
    sections.push('- Scales to 50+ components per workflow');
    sections.push('- Agent retrieves only what it needs, when it needs it');
    sections.push('');

    sections.push('**2.3. Complete Component**');
    sections.push('```json');
    sections.push('{');
    sections.push('  "runId": "{runId}",');
    sections.push('  "componentId": "{component ID}",');
    sections.push('  "output": {');
    sections.push('    // Component output data');
    sections.push('  },');
    sections.push('  "metrics": {');
    sections.push('    "tokensUsed": 1500,  // Estimate based on conversation');
    sections.push('    "durationSeconds": 30,  // Estimate');
    sections.push('    "userPrompts": 2,  // Count of user clarifications');
    sections.push('    "systemIterations": 3,  // Count of refinements');
    sections.push('    "linesOfCode": 50,  // If applicable');
    sections.push('    "costUsd": 0.0045  // Estimate: tokensUsed * 0.003 / 1000');
    sections.push('  },');
    sections.push('  "status": "completed"  // or "failed"');
    sections.push('}');
    sections.push('```');
    sections.push('');

    sections.push('**2.4. Store Artifacts** (if component produces code, reports, etc.)');
    sections.push('```json');
    sections.push('{');
    sections.push('  "runId": "{runId}",');
    sections.push('  "componentId": "{component ID}",');
    sections.push('  "artifactType": "code",  // or "report", "log", "diff", "test_results"');
    sections.push('  "data": {');
    sections.push('    // Artifact content (code, report, etc.)');
    sections.push('  },');
    sections.push('  "metadata": {');
    sections.push('    "format": "json",  // or "markdown", "code", "text"');
    sections.push('    "size": 1024,  // bytes');
    sections.push('    "filename": "review-report.md"');
    sections.push('  }');
    sections.push('}');
    sections.push('```');
    sections.push('');

    sections.push('### Step 3: Make Next Decision');
    sections.push('');
    const decisionStrategy = coordinator.decisionStrategy || 'adaptive';
    sections.push(`**Your Decision Strategy**: ${decisionStrategy}`);
    sections.push('');

    if (decisionStrategy === 'sequential') {
      sections.push('Execute components in order:');
      coordinator.components?.forEach((c, i) => {
        sections.push(`${i + 1}. ${c.name}`);
      });
    } else if (decisionStrategy === 'adaptive') {
      sections.push('Before deciding the next component:');
      sections.push('1. Call `get_workflow_context` to get previous component outputs');
      sections.push('2. Analyze the results');
      sections.push('3. Decide which component to run next based on the context');
      sections.push('4. Example: If code review found critical issues, run "Fix Issues" before "Run Tests"');
    } else {
      sections.push(`Follow the ${decisionStrategy} strategy to decide component execution order.`);
    }
    sections.push('');

    sections.push('### Step 4: Complete Workflow');
    sections.push('');
    sections.push('When all components are executed, call `update_workflow_status`:');
    sections.push('```json');
    sections.push('{');
    sections.push('  "runId": "{runId}",');
    sections.push('  "status": "completed",  // or "failed" if workflow failed');
    sections.push('  "summary": "Brief summary of workflow results"');
    sections.push('}');
    sections.push('```');
    sections.push('');
    sections.push('Then provide a comprehensive summary to the user:');
    sections.push('- Components executed');
    sections.push('- Key results from each component');
    sections.push('- Artifacts generated');
    sections.push('- Link to web UI for detailed results (if applicable)');
    sections.push('');

    sections.push('### Error Handling');
    sections.push('');
    sections.push('If a component fails:');
    sections.push('1. Always call `record_component_complete` with `status: "failed"` and `errorMessage`');
    sections.push('2. Determine failure strategy from component config:');
    sections.push('   - **stop**: Call `update_workflow_status` with "failed", stop execution');
    sections.push('   - **continue**: Log error, move to next component');
    sections.push('   - **retry**: Retry component up to 3 times');
    sections.push('   - **notify**: Ask user how to proceed');
    sections.push('');

    sections.push('### Available MCP Tools');
    sections.push('');
    sections.push('- `start_workflow_run(workflowId, triggeredBy, context)` - Initialize execution');
    sections.push('- `record_component_start(runId, componentId, input)` - Log component start');
    sections.push('- `record_component_complete(runId, componentId, output, metrics, status)` - Log completion');
    sections.push('- `get_workflow_context(runId)` - Get previous outputs for decision-making');
    sections.push('- `update_workflow_status(runId, status, summary?)` - Update workflow status');
    sections.push('- `store_artifact(runId, componentId, artifactType, data, metadata)` - Save outputs');
    sections.push('');

    // Decision Strategy section
    sections.push('## Decision Strategy Details');
    sections.push(decisionStrategy || 'Adaptive execution based on component outputs');
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
    // Use operationInstructions as the main coordinator logic
    sections.push(coordinator.coordinatorInstructions || coordinator.operationInstructions);
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
    if (coordinator.componentIds && coordinator.componentIds.length > 0) {
      sections.push('## Component References');
      sections.push('');
      sections.push('**Component IDs**:');
      coordinator.componentIds.forEach((id, index) => {
        const componentName = coordinator.components?.[index]?.name || 'Unknown';
        sections.push(`- ${componentName}: \`${id}\``);
      });
      sections.push('');
    } else if (coordinator.components && coordinator.components.length > 0) {
      sections.push('## Component References');
      sections.push('');
      sections.push('**Component IDs**:');
      coordinator.components.forEach((component) => {
        sections.push(`- ${component.name}: \`${component.id}\``);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  private static sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
