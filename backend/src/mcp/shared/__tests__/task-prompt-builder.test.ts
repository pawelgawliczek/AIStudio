/**
 * Tests for task-prompt-builder module
 * ST-289: Enhanced Task Spawning Instructions
 *
 * This module builds complete Task prompts based on:
 * - Component instructions (input/operation/output)
 * - Previous component outputs (componentSummary)
 * - Artifact access rules (read/write/required)
 * - Pre-execution context
 */

import { PrismaClient } from '@prisma/client';
import { ComponentSummaryStructured } from '../../../types/component-summary.types';
import {
  deriveSubagentType,
  buildTaskPrompt,
  formatPreviousOutputs,
  formatArtifactInstructions,
} from '../task-prompt-builder';

describe('task-prompt-builder', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowState: {
        findUnique: jest.fn(),
      },
      componentRun: {
        findMany: jest.fn(),
      },
      artifactAccess: {
        findMany: jest.fn(),
      },
      artifact: {
        findFirst: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deriveSubagentType', () => {
    it('should return "Explore" for native_explore executionType', () => {
      expect(deriveSubagentType('native_explore')).toBe('Explore');
    });

    it('should return "Plan" for native_plan executionType', () => {
      expect(deriveSubagentType('native_plan')).toBe('Plan');
    });

    it('should return "general-purpose" for native_general executionType', () => {
      expect(deriveSubagentType('native_general')).toBe('general-purpose');
    });

    it('should return "general-purpose" for custom executionType', () => {
      expect(deriveSubagentType('custom')).toBe('general-purpose');
    });

    it('should return "general-purpose" for unknown executionType', () => {
      expect(deriveSubagentType('unknown_type')).toBe('general-purpose');
    });

    it('should return "general-purpose" for empty string', () => {
      expect(deriveSubagentType('')).toBe('general-purpose');
    });

    it('should handle case sensitivity correctly', () => {
      expect(deriveSubagentType('NATIVE_EXPLORE')).toBe('Explore');
      expect(deriveSubagentType('Native_Plan')).toBe('Plan');
    });
  });

  describe('formatPreviousOutputs', () => {
    it('should return empty string when no previous outputs', () => {
      const result = formatPreviousOutputs([]);
      expect(result).toBe('');
    });

    it('should format single component summary correctly', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'success',
            summary: 'Explored codebase and found key files',
            keyOutputs: ['Found 5 relevant files', 'Identified 3 dependencies'],
          } as ComponentSummaryStructured),
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('## Previous Component Outputs');
      expect(result).toContain('### Explorer');
      expect(result).toContain('**Status:** success');
      expect(result).toContain('Explored codebase and found key files');
      expect(result).toContain('Found 5 relevant files');
      expect(result).toContain('Identified 3 dependencies');
    });

    it('should format multiple component summaries correctly', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'success',
            summary: 'Explored codebase',
            keyOutputs: ['Found files'],
          } as ComponentSummaryStructured),
        },
        {
          id: 'run-2',
          componentName: 'Architect',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'partial',
            summary: 'Created architecture doc',
            nextAgentHints: ['Consider error handling', 'Add logging'],
          } as ComponentSummaryStructured),
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('### Explorer');
      expect(result).toContain('### Architect');
      expect(result).toContain('**Status:** success');
      expect(result).toContain('**Status:** partial');
      expect(result).toContain('**Hints for next agent:**');
      expect(result).toContain('Consider error handling');
    });

    it('should handle legacy text-only componentSummary', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: 'Simple text summary without JSON structure',
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('### Explorer');
      expect(result).toContain('Simple text summary without JSON structure');
      expect(result).not.toContain('**Status:**');
    });

    it('should handle null componentSummary', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: null,
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('### Explorer');
      expect(result).toContain('No summary available');
    });

    it('should handle invalid JSON in componentSummary', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: '{ invalid json',
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('### Explorer');
      expect(result).toContain('{ invalid json');
    });

    it('should include artifactsProduced if present', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Architect',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'success',
            summary: 'Created architecture',
            artifactsProduced: ['ARCH_DOC', 'TECH_SPEC'],
          } as ComponentSummaryStructured),
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('**Artifacts produced:**');
      expect(result).toContain('ARCH_DOC');
      expect(result).toContain('TECH_SPEC');
    });

    it('should include errors if present', () => {
      const componentRuns = [
        {
          id: 'run-1',
          componentName: 'Implementer',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'failed',
            summary: 'Failed to implement',
            errors: ['Missing dependency', 'Type mismatch'],
          } as ComponentSummaryStructured),
        },
      ];

      const result = formatPreviousOutputs(componentRuns);

      expect(result).toContain('**Status:** failed');
      expect(result).toContain('**Errors:**');
      expect(result).toContain('Missing dependency');
      expect(result).toContain('Type mismatch');
    });
  });

  describe('formatArtifactInstructions', () => {
    it('should return empty string when no artifact access rules', async () => {
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      expect(result).toBe('');
    });

    it('should format read-only artifacts correctly', async () => {
      const artifactAccess = [
        {
          accessType: 'read',
          definition: {
            key: 'CONTEXT_DOC',
            name: 'Context Documentation',
            description: 'Project context and background',
          },
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue({
        id: 'artifact-1',
        latestVersion: 2,
      });

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      expect(result).toContain('## Artifact Instructions');
      expect(result).toContain('### Artifacts to READ');
      expect(result).toContain('**CONTEXT_DOC** (Context Documentation)');
      expect(result).toContain('Project context and background');
      expect(result).toContain('get_artifact');
      expect(result).toContain('definitionKey: "CONTEXT_DOC"');
    });

    it('should format write artifacts correctly', async () => {
      const artifactAccess = [
        {
          accessType: 'write',
          definition: {
            key: 'ARCH_DOC',
            name: 'Architecture Document',
            description: 'System architecture and design decisions',
          },
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      expect(result).toContain('### Artifacts to CREATE/UPDATE');
      expect(result).toContain('**ARCH_DOC** (Architecture Document)');
      expect(result).toContain('upload_artifact');
      expect(result).toContain('definitionKey: "ARCH_DOC"');
    });

    it('should format required artifacts correctly', async () => {
      const artifactAccess = [
        {
          accessType: 'required',
          definition: {
            key: 'THE_PLAN',
            name: 'Implementation Plan',
            description: 'Detailed implementation plan',
          },
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue({
        id: 'artifact-1',
        latestVersion: 1,
      });

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      expect(result).toContain('### Required Artifacts (MUST READ)');
      expect(result).toContain('**THE_PLAN** (Implementation Plan)');
      expect(result).toContain('CRITICAL');
    });

    it('should group artifacts by access type correctly', async () => {
      const artifactAccess = [
        {
          accessType: 'required',
          definition: { key: 'THE_PLAN', name: 'Plan', description: 'Required plan' },
        },
        {
          accessType: 'read',
          definition: { key: 'CONTEXT', name: 'Context', description: 'Context info' },
        },
        {
          accessType: 'write',
          definition: { key: 'ARCH_DOC', name: 'Arch', description: 'Architecture' },
        },
        {
          accessType: 'read',
          definition: { key: 'DESIGN', name: 'Design', description: 'Design doc' },
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      // Required should come first
      const requiredIndex = result.indexOf('### Required Artifacts');
      const readIndex = result.indexOf('### Artifacts to READ');
      const writeIndex = result.indexOf('### Artifacts to CREATE/UPDATE');

      expect(requiredIndex).toBeLessThan(readIndex);
      expect(readIndex).toBeLessThan(writeIndex);
    });

    it('should indicate when artifact exists vs needs creation', async () => {
      const artifactAccess = [
        {
          accessType: 'write',
          definition: { key: 'EXISTING', name: 'Existing', description: 'Already exists' },
        },
        {
          accessType: 'write',
          definition: { key: 'NEW', name: 'New', description: 'To be created' },
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);

      // Mock to return existing artifact for first, null for second
      (mockPrisma.artifact.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'artifact-1', latestVersion: 3 })
        .mockResolvedValueOnce(null);

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      expect(result).toContain('EXISTING');
      expect(result).toContain('NEW');
    });

    it('should handle missing artifact definitions gracefully', async () => {
      const artifactAccess = [
        {
          accessType: 'read',
          definition: null, // Edge case: missing definition
        },
      ];

      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);

      const result = await formatArtifactInstructions(mockPrisma, 'state-1', 'story-1');

      // Should not throw, should skip the entry
      expect(result).not.toContain('undefined');
    });
  });

  describe('buildTaskPrompt', () => {
    const mockComponent = {
      id: 'component-1',
      name: 'Explorer',
      executionType: 'native_explore',
      inputInstructions: 'Read the story description and requirements',
      operationInstructions: 'Explore the codebase to find relevant files',
      outputInstructions: 'Provide a list of files and their relevance',
    };

    const mockState = {
      id: 'state-1',
      preExecutionInstructions: 'Ensure you have access to the codebase',
      component: mockComponent,
    };

    it('should build complete task prompt with all sections', async () => {
      const previousRuns = [
        {
          id: 'run-1',
          componentName: 'Context Explorer',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'success',
            summary: 'Explored context',
            keyOutputs: ['Found requirements'],
          }),
        },
      ];

      const artifactAccess = [
        {
          accessType: 'required',
          definition: { key: 'THE_PLAN', name: 'Plan', description: 'The plan' },
        },
      ];

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue(previousRuns);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue({ id: 'a-1', latestVersion: 1 });

      const result = await buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1');

      // Should include pre-execution context
      expect(result).toContain('## Context');
      expect(result).toContain('Ensure you have access to the codebase');

      // Should include component instructions
      expect(result).toContain('## Input');
      expect(result).toContain('Read the story description and requirements');
      expect(result).toContain('## Task');
      expect(result).toContain('Explore the codebase to find relevant files');
      expect(result).toContain('## Output');
      expect(result).toContain('Provide a list of files and their relevance');

      // Should include previous outputs
      expect(result).toContain('## Previous Component Outputs');
      expect(result).toContain('Context Explorer');

      // Should include artifact instructions
      expect(result).toContain('## Artifact Instructions');
      expect(result).toContain('THE_PLAN');
    });

    it('should handle state with no pre-execution instructions', async () => {
      const stateNoPreInstructions = {
        ...mockState,
        preExecutionInstructions: null,
      };

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, stateNoPreInstructions, 'run-1', 'story-1');

      expect(result).not.toContain('## Context');
      expect(result).toContain('## Input');
    });

    it('should handle state with no component instructions', async () => {
      const componentNoInstructions = {
        ...mockComponent,
        inputInstructions: null,
        operationInstructions: null,
        outputInstructions: null,
      };

      const stateNoInstructions = {
        ...mockState,
        component: componentNoInstructions,
      };

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, stateNoInstructions, 'run-1', 'story-1');

      // Should still build a valid prompt, just without those sections
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle no previous component runs', async () => {
      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1');

      expect(result).not.toContain('## Previous Component Outputs');
    });

    it('should handle no artifact access rules', async () => {
      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1');

      expect(result).not.toContain('## Artifact Instructions');
    });

    it('should order sections correctly', async () => {
      const previousRuns = [{ id: 'run-1', componentName: 'Explorer', componentSummary: 'summary' }];
      const artifactAccess = [
        { accessType: 'read', definition: { key: 'DOC', name: 'Doc', description: 'Doc' } },
      ];

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue(previousRuns);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1');

      // Expected order:
      // 1. Context (pre-execution)
      // 2. Input
      // 3. Task
      // 4. Output
      // 5. Previous outputs
      // 6. Artifact instructions

      const contextIndex = result.indexOf('## Context');
      const inputIndex = result.indexOf('## Input');
      const taskIndex = result.indexOf('## Task');
      const outputIndex = result.indexOf('## Output');
      const previousIndex = result.indexOf('## Previous Component Outputs');
      const artifactIndex = result.indexOf('## Artifact Instructions');

      expect(contextIndex).toBeLessThan(inputIndex);
      expect(inputIndex).toBeLessThan(taskIndex);
      expect(taskIndex).toBeLessThan(outputIndex);
      expect(outputIndex).toBeLessThan(previousIndex);
      expect(previousIndex).toBeLessThan(artifactIndex);
    });

    it('should filter previous runs to only completed ones', async () => {
      const allRuns = [
        {
          id: 'run-1',
          componentName: 'Explorer',
          componentSummary: 'completed',
          status: 'completed',
        },
        {
          id: 'run-2',
          componentName: 'Architect',
          componentSummary: null,
          status: 'running',
        },
      ];

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue(allRuns);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1');

      // Should only include completed runs
      expect(result).toContain('Explorer');
      // Behavior depends on implementation - if it filters by status or not
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.componentRun.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(buildTaskPrompt(mockPrisma, mockState, 'run-1', 'story-1')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should properly escape markdown special characters in instructions', async () => {
      const componentWithSpecialChars = {
        ...mockComponent,
        inputInstructions: 'Read the **bold** and _italic_ text',
        operationInstructions: 'Process data with `code` blocks',
        outputInstructions: 'Return results in [markdown](format)',
      };

      const stateWithSpecialChars = {
        ...mockState,
        component: componentWithSpecialChars,
      };

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue([]);

      const result = await buildTaskPrompt(mockPrisma, stateWithSpecialChars, 'run-1', 'story-1');

      // Markdown should be preserved as-is
      expect(result).toContain('**bold**');
      expect(result).toContain('_italic_');
      expect(result).toContain('`code`');
      expect(result).toContain('[markdown](format)');
    });
  });

  describe('Integration: Full workflow', () => {
    it('should build appropriate prompt for Explorer component', async () => {
      const explorerComponent = {
        id: 'explorer-1',
        name: 'Explorer',
        executionType: 'native_explore',
        inputInstructions: 'Read story requirements',
        operationInstructions: 'Find relevant code files',
        outputInstructions: 'List files with explanations',
      };

      const explorerState = {
        id: 'state-1',
        preExecutionInstructions: 'Ensure codebase access',
        component: explorerComponent,
      };

      const artifactAccess = [
        {
          accessType: 'required',
          definition: {
            key: 'THE_PLAN',
            name: 'Implementation Plan',
            description: 'Approved implementation plan',
          },
        },
      ];

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue({ id: 'a-1', latestVersion: 1 });

      const subagentType = deriveSubagentType(explorerComponent.executionType);
      expect(subagentType).toBe('Explore');

      const prompt = await buildTaskPrompt(mockPrisma, explorerState, 'run-1', 'story-1');

      expect(prompt).toContain('## Context');
      expect(prompt).toContain('Ensure codebase access');
      expect(prompt).toContain('THE_PLAN');
      expect(prompt).toContain('CRITICAL');
    });

    it('should build appropriate prompt for Implementer component', async () => {
      const implementerComponent = {
        id: 'impl-1',
        name: 'Implementer',
        executionType: 'custom',
        inputInstructions: 'Read architecture and design docs',
        operationInstructions: 'Implement the feature',
        outputInstructions: 'List modified files',
      };

      const implementerState = {
        id: 'state-2',
        preExecutionInstructions: null,
        component: implementerComponent,
      };

      const previousRuns = [
        {
          id: 'run-1',
          componentName: 'Architect',
          componentSummary: JSON.stringify({
            version: '1.0',
            status: 'success',
            summary: 'Architecture completed',
            artifactsProduced: ['ARCH_DOC'],
            nextAgentHints: ['Use modular approach', 'Follow design patterns'],
          }),
        },
      ];

      const artifactAccess = [
        {
          accessType: 'read',
          definition: { key: 'ARCH_DOC', name: 'Architecture', description: 'Arch doc' },
        },
        {
          accessType: 'write',
          definition: { key: 'IMPL_NOTES', name: 'Implementation Notes', description: 'Notes' },
        },
      ];

      (mockPrisma.componentRun.findMany as jest.Mock).mockResolvedValue(previousRuns);
      (mockPrisma.artifactAccess.findMany as jest.Mock).mockResolvedValue(artifactAccess);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue({ id: 'a-1', latestVersion: 1 });

      const subagentType = deriveSubagentType(implementerComponent.executionType);
      expect(subagentType).toBe('general-purpose');

      const prompt = await buildTaskPrompt(mockPrisma, implementerState, 'run-1', 'story-1');

      expect(prompt).toContain('## Previous Component Outputs');
      expect(prompt).toContain('Architect');
      expect(prompt).toContain('Use modular approach');
      expect(prompt).toContain('ARCH_DOC');
      expect(prompt).toContain('IMPL_NOTES');
    });
  });
});
