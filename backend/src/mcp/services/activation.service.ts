import * as fs from 'fs/promises';
import * as path from 'path';
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ComponentAgentGenerator } from '../generators/component-agent-generator';
import { CoordinatorAgentGenerator } from '../generators/coordinator-agent-generator';
import { WorkflowSkillGenerator } from '../generators/workflow-skill-generator';
import { AgentFileValidator, ValidationError } from '../validators/agent-file-validator';
import { WorkflowMetadataValidator } from '../validators/workflow-metadata-validator';

export interface ActivationOptions {
  forceOverwrite?: boolean;
  skipBackup?: boolean;
  projectRoot?: string; // Path to project root (where .claude/ should be)
}

export interface ActivationResult {
  success: boolean;
  filesGenerated: string[];
  conflicts?: string[];
  backupLocation?: string;
  activationId: string;
  version: string;
  errors?: ValidationError[];
}

export interface DeactivationResult {
  success: boolean;
  filesRemoved: string[];
  workflowId: string;
  deactivatedAt: string;
}

export interface SyncResult {
  success: boolean;
  updated: boolean;
  previousVersion: string;
  newVersion: string;
  filesUpdated: string[];
  changes: string[];
}

@Injectable()
export class ActivationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Activate a workflow in Claude Code
   */
  async activateWorkflow(
    workflowId: string,
    projectId: string,
    userId: string,
    options: ActivationOptions = {},
  ): Promise<ActivationResult> {
    // 1. Check if another workflow is already active
    const existingActive = await this.prisma.activeWorkflow.findUnique({
      where: { projectId },
      include: { workflow: true },
    });

    if (existingActive && existingActive.workflowId !== workflowId) {
      if (!options.forceOverwrite) {
        throw new ConflictException(
          `Another workflow "${existingActive.workflow.name}" is already active. Deactivate it first or use forceOverwrite option.`,
        );
      }
      // Deactivate existing workflow
      await this.deactivateWorkflow(projectId, { keepFiles: false });
    }

    // 2. Fetch workflow with all relations
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        project: true,
      },
    });

    if (!workflow) {
      throw new BadRequestException('Workflow not found');
    }

    if (workflow.projectId !== projectId) {
      throw new BadRequestException('Workflow does not belong to this project');
    }

    // 3. Fetch components from workflow component assignments
    const componentAssignments = (workflow.componentAssignments as any[]) || [];
    const componentIds = componentAssignments.map((ca: any) => ca.componentId).filter(Boolean);
    const components = await this.prisma.component.findMany({
      where: {
        id: { in: componentIds as string[] },
      },
    });

    // 4. Validate workflow is complete
    const validationResult = WorkflowMetadataValidator.validateWorkflowComplete({
      ...workflow,
      components,
    });

    if (!validationResult.valid) {
      throw new BadRequestException(
        `Workflow validation failed: ${validationResult.errors.map((e) => e.error).join(', ')}`,
      );
    }

    // 5. Determine project root
    const projectRoot = options.projectRoot || process.cwd();
    const claudeDir = path.join(projectRoot, '.claude');
    const agentsDir = path.join(claudeDir, 'agents');
    const skillsDir = path.join(claudeDir, 'skills');

    // 6. Check for existing files and handle conflicts
    const conflicts: string[] = [];
    const filesToGenerate = this.getFilePathsToGenerate(workflow.name, components);

    for (const filePath of filesToGenerate) {
      const fullPath = path.join(projectRoot, filePath);
      if (await this.fileExists(fullPath)) {
        conflicts.push(filePath);
      }
    }

    let backupLocation: string | undefined;
    if (conflicts.length > 0 && !options.skipBackup) {
      backupLocation = await this.backupFiles(projectRoot, conflicts);
    }

    // 7. Create directories if they don't exist
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });

    // 8. Generate files
    const filesGenerated: string[] = [];

    try {
      // Generate workflow metadata file (coordinators are deprecated - ST-164)
      // Note: This section may need refactoring based on new workflow architecture

      // Generate component agent files
      for (const component of components) {
        const componentFile = ComponentAgentGenerator.generate(component);
        await fs.writeFile(path.join(projectRoot, componentFile.filename), componentFile.content);
        filesGenerated.push(componentFile.filename);
      }

      // Generate workflow skill file
      const workflowFile = WorkflowSkillGenerator.generate(
        {
          ...workflow,
          components,
        },
        new Date(),
      );
      await fs.writeFile(path.join(projectRoot, workflowFile.filename), workflowFile.content);
      filesGenerated.push(workflowFile.filename);

      // 9. Validate generated files
      const fileValidation = await AgentFileValidator.validateFiles(
        filesGenerated.map((f) => path.join(projectRoot, f)),
      );

      if (!fileValidation.valid) {
        // Rollback on validation failure
        await this.deleteFiles(projectRoot, filesGenerated);
        throw new BadRequestException(
          `Generated files validation failed: ${fileValidation.errors.map((e) => e.error).join(', ')}`,
        );
      }

      // 10. Create or update ActiveWorkflow record
      const activeWorkflow = await this.prisma.activeWorkflow.upsert({
        where: { projectId },
        create: {
          projectId,
          workflowId,
          version: workflow.version,
          activatedBy: userId,
          filesGenerated,
          status: 'active',
          autoSync: false,
        },
        update: {
          workflowId,
          version: workflow.version,
          activatedAt: new Date(),
          activatedBy: userId,
          filesGenerated,
          status: 'active',
        },
      });

      return {
        success: true,
        filesGenerated,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        backupLocation,
        activationId: activeWorkflow.id,
        version: workflow.version,
      };
    } catch (error) {
      // Rollback on any error
      await this.deleteFiles(projectRoot, filesGenerated);
      throw error;
    }
  }

  /**
   * Deactivate the currently active workflow
   */
  async deactivateWorkflow(
    projectId: string,
    options: { keepFiles?: boolean } = {},
  ): Promise<DeactivationResult> {
    const activeWorkflow = await this.prisma.activeWorkflow.findUnique({
      where: { projectId },
      include: { workflow: true },
    });

    if (!activeWorkflow) {
      throw new BadRequestException('No active workflow found for this project');
    }

    const filesRemoved: string[] = [];

    if (!options.keepFiles) {
      // Delete generated files
      const projectRoot = process.cwd();
      for (const filePath of activeWorkflow.filesGenerated) {
        const fullPath = path.join(projectRoot, filePath);
        try {
          await fs.unlink(fullPath);
          filesRemoved.push(filePath);
        } catch (error) {
          // File might not exist, ignore
        }
      }
    }

    // Update status to deactivated
    await this.prisma.activeWorkflow.update({
      where: { projectId },
      data: {
        status: 'deactivated',
      },
    });

    return {
      success: true,
      filesRemoved,
      workflowId: activeWorkflow.workflowId,
      deactivatedAt: new Date().toISOString(),
    };
  }

  /**
   * Sync the active workflow to the latest version
   */
  async syncWorkflow(projectId: string): Promise<SyncResult> {
    const activeWorkflow = await this.prisma.activeWorkflow.findUnique({
      where: { projectId },
      include: {
        workflow: true,
      },
    });

    if (!activeWorkflow) {
      throw new BadRequestException('No active workflow found for this project');
    }

    const currentVersion = activeWorkflow.version;
    const latestVersion = activeWorkflow.workflow.version;

    if (currentVersion === latestVersion) {
      return {
        success: true,
        updated: false,
        previousVersion: currentVersion,
        newVersion: latestVersion,
        filesUpdated: [],
        changes: ['No updates needed - already at latest version'],
      };
    }

    // Backup existing files
    const projectRoot = process.cwd();
    const backupLocation = await this.backupFiles(
      projectRoot,
      activeWorkflow.filesGenerated,
    );

    // Re-activate with the latest version
    const activationResult = await this.activateWorkflow(
      activeWorkflow.workflowId,
      projectId,
      activeWorkflow.activatedBy,
      {
        forceOverwrite: true,
        skipBackup: true, // Already backed up
        projectRoot,
      },
    );

    return {
      success: true,
      updated: true,
      previousVersion: currentVersion,
      newVersion: latestVersion,
      filesUpdated: activationResult.filesGenerated,
      changes: [
        `Updated from ${currentVersion} to ${latestVersion}`,
        `Backup created at: ${backupLocation}`,
      ],
    };
  }

  /**
   * Get the currently active workflow for a project
   */
  async getActiveWorkflow(projectId: string) {
    const activeWorkflow = await this.prisma.activeWorkflow.findUnique({
      where: { projectId },
      include: {
        workflow: true,
      },
    });

    if (!activeWorkflow) {
      return null;
    }

    return {
      workflowId: activeWorkflow.workflowId,
      workflowName: activeWorkflow.workflow.name,
      version: activeWorkflow.version,
      activatedAt: activeWorkflow.activatedAt.toISOString(),
      filesGenerated: activeWorkflow.filesGenerated,
      autoSync: activeWorkflow.autoSync,
      status: activeWorkflow.status,
    };
  }

  // Helper methods

  private getFilePathsToGenerate(workflowName: string, components: any[]): string[] {
    const sanitize = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const files = [
      `.claude/agents/coordinator-${sanitize(workflowName)}.md`,
      `.claude/skills/workflow-${sanitize(workflowName)}.md`,
    ];

    for (const component of components) {
      files.push(`.claude/agents/component-${sanitize(component.name)}.md`);
    }

    return files;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async backupFiles(
    projectRoot: string,
    filePaths: string[],
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(projectRoot, '.claude', 'backups', timestamp);

    await fs.mkdir(backupDir, { recursive: true });

    for (const filePath of filePaths) {
      const fullPath = path.join(projectRoot, filePath);
      if (await this.fileExists(fullPath)) {
        const fileName = path.basename(filePath);
        const backupPath = path.join(backupDir, fileName);
        await fs.copyFile(fullPath, backupPath);
      }
    }

    return `.claude/backups/${timestamp}`;
  }

  private async deleteFiles(projectRoot: string, filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      const fullPath = path.join(projectRoot, filePath);
      try {
        await fs.unlink(fullPath);
      } catch {
        // Ignore errors
      }
    }
  }
}
