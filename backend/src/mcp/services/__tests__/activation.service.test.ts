/**
 * Unit tests for ActivationService - ST-355
 *
 * Tests cover workflow activation functionality:
 * - Workflow activation
 * - Workflow deactivation
 * - Workflow synchronization
 * - File generation and validation
 * - Conflict handling and backups
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ComponentAgentGenerator } from '../../generators/component-agent-generator';
import { WorkflowSkillGenerator } from '../../generators/workflow-skill-generator';
import { AgentFileValidator } from '../../validators/agent-file-validator';
import { WorkflowMetadataValidator } from '../../validators/workflow-metadata-validator';
import { ActivationService } from '../activation.service';

jest.mock('fs/promises');
jest.mock('../../generators/component-agent-generator');
jest.mock('../../generators/workflow-skill-generator');
jest.mock('../../validators/agent-file-validator');
jest.mock('../../validators/workflow-metadata-validator');

describe('ActivationService', () => {
  let service: ActivationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      activeWorkflow: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
      },
      component: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new ActivationService(mockPrisma as PrismaClient);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Workflow Activation
  // ==========================================================================

  describe('activateWorkflow', () => {
    const mockWorkflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      version: 'v1.0.0',
      projectId: 'project-456',
      componentAssignments: [
        { componentId: 'comp-1' },
        { componentId: 'comp-2' },
      ],
      project: { name: 'Test Project' },
    };

    const mockComponents = [
      { id: 'comp-1', name: 'Explorer' },
      { id: 'comp-2', name: 'Implementer' },
    ];

    beforeEach(() => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(null);
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.component.findMany.mockResolvedValue(mockComponents);

      (WorkflowMetadataValidator.validateWorkflowComplete as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });

      (ComponentAgentGenerator.generate as jest.Mock).mockReturnValue({
        filename: '.claude/agents/component-test.md',
        content: 'Component content',
      });

      (WorkflowSkillGenerator.generate as jest.Mock).mockReturnValue({
        filename: '.claude/skills/workflow-test.md',
        content: 'Workflow content',
      });

      (AgentFileValidator.validateFiles as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should activate workflow successfully', async () => {
      mockPrisma.activeWorkflow.upsert.mockResolvedValue({
        id: 'active-123',
      });

      const result = await service.activateWorkflow(
        'workflow-123',
        'project-456',
        'user-789'
      );

      expect(result.success).toBe(true);
      expect(result.filesGenerated.length).toBeGreaterThan(0);
      expect(result.activationId).toBe('active-123');
      expect(result.version).toBe('v1.0.0');
    });

    it('should throw error when another workflow is active without forceOverwrite', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        workflowId: 'other-workflow',
        workflow: { name: 'Other Workflow' },
      });

      await expect(
        service.activateWorkflow('workflow-123', 'project-456', 'user-789')
      ).rejects.toThrow(ConflictException);
    });

    it('should deactivate existing workflow when forceOverwrite is true', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        workflowId: 'other-workflow',
        workflow: { name: 'Other Workflow' },
        filesGenerated: ['.claude/agents/old.md'],
      });

      mockPrisma.activeWorkflow.upsert.mockResolvedValue({ id: 'active-123' });
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.activateWorkflow(
        'workflow-123',
        'project-456',
        'user-789',
        { forceOverwrite: true }
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.activeWorkflow.update).toHaveBeenCalled();
    });

    it('should throw error when workflow not found', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(
        service.activateWorkflow('workflow-123', 'project-456', 'user-789')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when workflow belongs to different project', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        projectId: 'different-project',
      });

      await expect(
        service.activateWorkflow('workflow-123', 'project-456', 'user-789')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when workflow validation fails', async () => {
      (WorkflowMetadataValidator.validateWorkflowComplete as jest.Mock).mockReturnValue({
        valid: false,
        errors: [{ error: 'Missing component' }],
      });

      await expect(
        service.activateWorkflow('workflow-123', 'project-456', 'user-789')
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect file conflicts', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined); // Files exist

      mockPrisma.activeWorkflow.upsert.mockResolvedValue({ id: 'active-123' });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.copyFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.activateWorkflow(
        'workflow-123',
        'project-456',
        'user-789'
      );

      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(0);
      expect(result.backupLocation).toBeDefined();
    });

    it('should rollback on file validation failure', async () => {
      (AgentFileValidator.validateFiles as jest.Mock).mockResolvedValue({
        valid: false,
        errors: [{ error: 'Invalid syntax' }],
      });

      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.activateWorkflow('workflow-123', 'project-456', 'user-789')
      ).rejects.toThrow(BadRequestException);

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should use custom project root when provided', async () => {
      mockPrisma.activeWorkflow.upsert.mockResolvedValue({ id: 'active-123' });

      await service.activateWorkflow(
        'workflow-123',
        'project-456',
        'user-789',
        { projectRoot: '/custom/path' }
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path/.claude'),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // GROUP 2: Workflow Deactivation
  // ==========================================================================

  describe('deactivateWorkflow', () => {
    it('should deactivate workflow successfully', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        workflowId: 'workflow-123',
        workflow: { name: 'Test Workflow' },
        filesGenerated: [
          '.claude/agents/component-explorer.md',
          '.claude/skills/workflow-test.md',
        ],
      });

      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deactivateWorkflow('project-456');

      expect(result.success).toBe(true);
      expect(result.filesRemoved.length).toBe(2);
      expect(result.workflowId).toBe('workflow-123');
      expect(mockPrisma.activeWorkflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'deactivated' },
        })
      );
    });

    it('should throw error when no active workflow found', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(null);

      await expect(service.deactivateWorkflow('project-456')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should keep files when keepFiles option is true', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        workflowId: 'workflow-123',
        workflow: { name: 'Test Workflow' },
        filesGenerated: ['.claude/agents/test.md'],
      });

      const result = await service.deactivateWorkflow('project-456', { keepFiles: true });

      expect(result.filesRemoved.length).toBe(0);
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should ignore errors when deleting non-existent files', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        workflowId: 'workflow-123',
        workflow: { name: 'Test Workflow' },
        filesGenerated: ['.claude/agents/missing.md'],
      });

      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await service.deactivateWorkflow('project-456');

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // GROUP 3: Workflow Synchronization
  // ==========================================================================

  describe('syncWorkflow', () => {
    it('should return no update when already at latest version', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue({
        version: 'v1.0.0',
        workflow: { version: 'v1.0.0' },
        filesGenerated: [],
      });

      const result = await service.syncWorkflow('project-456');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.previousVersion).toBe('v1.0.0');
      expect(result.newVersion).toBe('v1.0.0');
    });

    it('should throw error when no active workflow found', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(null);

      await expect(service.syncWorkflow('project-456')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should sync to latest version successfully', async () => {
      const mockActiveWorkflow = {
        workflowId: 'workflow-123',
        version: 'v1.0.0',
        activatedBy: 'user-789',
        workflow: {
          version: 'v2.0.0',
          id: 'workflow-123',
          name: 'Test Workflow',
          projectId: 'project-456',
          componentAssignments: [{ componentId: 'comp-1' }],
        },
        filesGenerated: ['.claude/agents/old.md'],
      };

      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(mockActiveWorkflow);
      mockPrisma.workflow.findUnique.mockResolvedValue(mockActiveWorkflow.workflow);
      mockPrisma.component.findMany.mockResolvedValue([{ id: 'comp-1', name: 'Test' }]);
      mockPrisma.activeWorkflow.upsert.mockResolvedValue({ id: 'active-123' });

      (WorkflowMetadataValidator.validateWorkflowComplete as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });

      (ComponentAgentGenerator.generate as jest.Mock).mockReturnValue({
        filename: '.claude/agents/component-test.md',
        content: 'Component content',
      });

      (WorkflowSkillGenerator.generate as jest.Mock).mockReturnValue({
        filename: '.claude/skills/workflow-test.md',
        content: 'Workflow content',
      });

      (AgentFileValidator.validateFiles as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (fs.access as jest.Mock).mockRejectedValue(new Error('Not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.copyFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.syncWorkflow('project-456');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.previousVersion).toBe('v1.0.0');
      expect(result.newVersion).toBe('v2.0.0');
    });
  });

  // ==========================================================================
  // GROUP 4: Get Active Workflow
  // ==========================================================================

  describe('getActiveWorkflow', () => {
    it('should return active workflow details', async () => {
      const mockActiveWorkflow = {
        workflowId: 'workflow-123',
        workflow: { name: 'Test Workflow' },
        version: 'v1.0.0',
        activatedAt: new Date('2025-01-01'),
        filesGenerated: ['.claude/agents/test.md'],
        autoSync: false,
        status: 'active',
      };

      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(mockActiveWorkflow);

      const result = await service.getActiveWorkflow('project-456');

      expect(result).toEqual({
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        version: 'v1.0.0',
        activatedAt: '2025-01-01T00:00:00.000Z',
        filesGenerated: ['.claude/agents/test.md'],
        autoSync: false,
        status: 'active',
      });
    });

    it('should return null when no active workflow', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(null);

      const result = await service.getActiveWorkflow('project-456');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // GROUP 5: Helper Methods
  // ==========================================================================

  describe('Helper Methods', () => {
    it('should generate correct file paths', () => {
      const components = [
        { name: 'Business Analyst' },
        { name: 'Code Explorer' },
      ];

      const paths = (service as any).getFilePathsToGenerate(
        'My Workflow',
        components
      );

      expect(paths).toContain('.claude/agents/coordinator-my-workflow.md');
      expect(paths).toContain('.claude/skills/workflow-my-workflow.md');
      expect(paths).toContain('.claude/agents/component-business-analyst.md');
      expect(paths).toContain('.claude/agents/component-code-explorer.md');
    });

    it('should check file existence correctly', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const exists = await (service as any).fileExists('/test/path');

      expect(exists).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/path');
    });

    it('should return false when file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('Not found'));

      const exists = await (service as any).fileExists('/test/path');

      expect(exists).toBe(false);
    });

    it('should backup files correctly', async () => {
      const projectRoot = '/test/project';
      const filePaths = ['.claude/agents/test.md', '.claude/skills/workflow.md'];

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.copyFile as jest.Mock).mockResolvedValue(undefined);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const backupLocation = await (service as any).backupFiles(projectRoot, filePaths);

      expect(backupLocation).toMatch(/^\.claude\/backups\//);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should delete files correctly', async () => {
      const projectRoot = '/test/project';
      const filePaths = ['.claude/agents/test.md'];

      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await (service as any).deleteFiles(projectRoot, filePaths);

      expect(fs.unlink).toHaveBeenCalledWith(
        path.join(projectRoot, '.claude/agents/test.md')
      );
    });

    it('should ignore errors when deleting files', async () => {
      const projectRoot = '/test/project';
      const filePaths = ['.claude/agents/missing.md'];

      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(
        (service as any).deleteFiles(projectRoot, filePaths)
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP 6: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty component assignments', async () => {
      mockPrisma.activeWorkflow.findUnique.mockResolvedValue(null);
      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: 'workflow-123',
        name: 'Test Workflow',
        version: 'v1.0.0',
        projectId: 'project-456',
        componentAssignments: [],
        project: { name: 'Test' },
      });
      mockPrisma.component.findMany.mockResolvedValue([]);
      mockPrisma.activeWorkflow.upsert.mockResolvedValue({ id: 'active-123' });

      (WorkflowMetadataValidator.validateWorkflowComplete as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
      });

      (WorkflowSkillGenerator.generate as jest.Mock).mockReturnValue({
        filename: '.claude/skills/workflow-test.md',
        content: 'Content',
      });

      (AgentFileValidator.validateFiles as jest.Mock).mockResolvedValue({
        valid: true,
        errors: [],
      });

      (fs.access as jest.Mock).mockRejectedValue(new Error('Not found'));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.activateWorkflow(
        'workflow-123',
        'project-456',
        'user-789'
      );

      expect(result.success).toBe(true);
    });

    it('should sanitize workflow names correctly', () => {
      const paths = (service as any).getFilePathsToGenerate(
        'My-Workflow!@#$%^&*()',
        []
      );

      expect(paths[0]).toMatch(/coordinator-my-workflow/);
      expect(paths[1]).toMatch(/workflow-my-workflow/);
    });
  });
});
