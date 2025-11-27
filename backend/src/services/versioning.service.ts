import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Component, Workflow } from '@prisma/client';
import * as crypto from 'crypto';

// Types
export type VersionableEntityType = 'component' | 'workflow';

export interface VersionNode {
  id: string;
  versionMajor: number;
  versionMinor: number;
  versionLabel: string;
  parentId: string | null;
  isDeprecated: boolean;
  changeDescription: string | null;
  createdAt: Date;
  children: VersionNode[];
}

export interface VersionHistoryItem {
  id: string;
  versionMajor: number;
  versionMinor: number;
  versionLabel: string;
  parentId: string | null;
  isDeprecated: boolean;
  changeDescription: string | null;
  createdFromVersion: string | null;
  instructionsChecksum: string | null;
  configChecksum: string | null;
  createdAt: Date;
}

export interface CreateVersionOptions {
  changeDescription?: string;
}

@Injectable()
export class VersioningService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate MD5 checksum of normalized JSON data
   * Keys are sorted recursively for deterministic output
   */
  calculateChecksum(data: any): string {
    if (data === null || data === undefined) {
      return crypto.createHash('md5').update('null').digest('hex');
    }
    const normalized = JSON.stringify(this.sortObjectKeys(data));
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Create a minor version increment (e.g., 1.0 -> 1.1)
   */
  async createMinorVersion(
    entityType: VersionableEntityType,
    entityId: string,
    options?: CreateVersionOptions,
  ): Promise<Component | Workflow> {
    return this.prisma.$transaction(async (tx) => {
      const source = await this.getEntityWithTx(tx, entityType, entityId);

      if (source.isDeprecated) {
        throw new BadRequestException(
          `Cannot create version from deprecated ${entityType}`,
        );
      }

      const checksums = this.calculateEntityChecksums(source, entityType);
      const createdFromVersion = `${source.versionMajor}.${source.versionMinor}`;

      const newData = this.buildNewVersionData(source, entityType, {
        versionMajor: source.versionMajor,
        versionMinor: source.versionMinor + 1,
        parentId: entityId,
        createdFromVersion,
        changeDescription: options?.changeDescription || null,
        ...checksums,
      });

      // Debug logging for componentAssignments
      if (entityType === 'workflow' && newData.componentAssignments) {
        console.log('[VERSIONING] Creating minor version with componentAssignments:',
          JSON.stringify(newData.componentAssignments, null, 2));
      }

      if (entityType === 'component') {
        return tx.component.create({ data: newData });
      } else {
        return tx.workflow.create({ data: newData });
      }
    });
  }

  /**
   * Create a major version (e.g., 1.x -> 2.0)
   */
  async createMajorVersion(
    entityType: VersionableEntityType,
    entityId: string,
    majorVersion: number,
    options?: CreateVersionOptions,
  ): Promise<Component | Workflow> {
    if (majorVersion <= 0) {
      throw new BadRequestException('Major version must be greater than 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const source = await this.getEntityWithTx(tx, entityType, entityId);

      if (source.isDeprecated) {
        throw new BadRequestException(
          `Cannot create version from deprecated ${entityType}`,
        );
      }

      if (majorVersion <= source.versionMajor) {
        throw new BadRequestException(
          `New major version must be greater than current (${source.versionMajor})`,
        );
      }

      const checksums = this.calculateEntityChecksums(source, entityType);
      const createdFromVersion = `${source.versionMajor}.${source.versionMinor}`;

      const newData = this.buildNewVersionData(source, entityType, {
        versionMajor: majorVersion,
        versionMinor: 0,
        parentId: entityId,
        createdFromVersion,
        changeDescription: options?.changeDescription || null,
        ...checksums,
      });

      if (entityType === 'component') {
        return tx.component.create({ data: newData });
      } else {
        return tx.workflow.create({ data: newData });
      }
    });
  }

  /**
   * Get version history by traversing parentId chain (oldest to newest)
   */
  async getVersionHistory(
    entityType: VersionableEntityType,
    entityId: string,
  ): Promise<VersionHistoryItem[]> {
    const history: VersionHistoryItem[] = [];
    let current = await this.getEntity(entityType, entityId);

    // Traverse to root while building history
    while (current) {
      history.unshift(this.mapToHistoryItem(current));
      if (!current.parentId) break;
      current = await this.getEntity(entityType, current.parentId);
    }

    return history;
  }

  /**
   * Build version lineage tree from root
   */
  async getVersionLineageTree(
    entityType: VersionableEntityType,
    entityId: string,
  ): Promise<VersionNode> {
    // Find root
    const root = await this.findRoot(entityType, entityId);
    // Build tree recursively
    return this.buildTree(entityType, root);
  }

  // Private helper methods

  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.sortObjectKeys(item));
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = this.sortObjectKeys(obj[key]);
        return sorted;
      }, {} as any);
  }

  private async getEntity(
    entityType: VersionableEntityType,
    id: string,
  ): Promise<any> {
    const entity =
      entityType === 'component'
        ? await this.prisma.component.findUnique({ where: { id } })
        : await this.prisma.workflow.findUnique({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`${entityType} ${id} not found`);
    }
    return entity;
  }

  private async getEntityWithTx(
    tx: any,
    entityType: VersionableEntityType,
    id: string,
  ): Promise<any> {
    const entity =
      entityType === 'component'
        ? await tx.component.findUnique({ where: { id } })
        : await tx.workflow.findUnique({ where: { id } });

    if (!entity) {
      throw new NotFoundException(`${entityType} ${id} not found`);
    }
    return entity;
  }

  private async findRoot(
    entityType: VersionableEntityType,
    entityId: string,
  ): Promise<any> {
    let current = await this.getEntity(entityType, entityId);
    while (current.parentId) {
      current = await this.getEntity(entityType, current.parentId);
    }
    return current;
  }

  private async getChildren(
    entityType: VersionableEntityType,
    parentId: string,
  ): Promise<any[]> {
    if (entityType === 'component') {
      return this.prisma.component.findMany({
        where: { parentId },
        orderBy: [{ versionMajor: 'asc' }, { versionMinor: 'asc' }],
      });
    } else {
      return this.prisma.workflow.findMany({
        where: { parentId },
        orderBy: [{ versionMajor: 'asc' }, { versionMinor: 'asc' }],
      });
    }
  }

  private async buildTree(
    entityType: VersionableEntityType,
    entity: any,
  ): Promise<VersionNode> {
    const children = await this.getChildren(entityType, entity.id);
    return {
      id: entity.id,
      versionMajor: entity.versionMajor,
      versionMinor: entity.versionMinor,
      versionLabel: `${entity.versionMajor}.${entity.versionMinor}`,
      parentId: entity.parentId,
      isDeprecated: entity.isDeprecated,
      changeDescription: entity.changeDescription,
      createdAt: entity.createdAt,
      children: await Promise.all(
        children.map((child) => this.buildTree(entityType, child)),
      ),
    };
  }

  private mapToHistoryItem(entity: any): VersionHistoryItem {
    return {
      id: entity.id,
      versionMajor: entity.versionMajor,
      versionMinor: entity.versionMinor,
      versionLabel: `${entity.versionMajor}.${entity.versionMinor}`,
      parentId: entity.parentId,
      isDeprecated: entity.isDeprecated,
      changeDescription: entity.changeDescription,
      createdFromVersion: entity.createdFromVersion,
      instructionsChecksum: entity.instructionsChecksum,
      configChecksum: entity.configChecksum,
      createdAt: entity.createdAt,
    };
  }

  private calculateEntityChecksums(
    entity: any,
    entityType: VersionableEntityType,
  ): { instructionsChecksum: string; configChecksum: string } {
    if (entityType === 'component') {
      return {
        instructionsChecksum: this.calculateChecksum({
          inputInstructions: entity.inputInstructions,
          operationInstructions: entity.operationInstructions,
          outputInstructions: entity.outputInstructions,
        }),
        configChecksum: this.calculateChecksum(entity.config),
      };
    } else {
      return {
        instructionsChecksum: this.calculateChecksum({
          coordinatorId: entity.coordinatorId,
          triggerConfig: entity.triggerConfig,
        }),
        configChecksum: this.calculateChecksum(entity.triggerConfig),
      };
    }
  }

  private buildNewVersionData(
    source: any,
    entityType: VersionableEntityType,
    versionFields: {
      versionMajor: number;
      versionMinor: number;
      parentId: string;
      createdFromVersion: string;
      changeDescription: string | null;
      instructionsChecksum: string;
      configChecksum: string;
    },
  ): any {
    // Common fields to exclude when copying
    const excludeFields = [
      'id',
      'createdAt',
      'updatedAt',
      'versionMajor',
      'versionMinor',
      'parentId',
      'instructionsChecksum',
      'configChecksum',
      'createdFromVersion',
      'changeDescription',
      'isDeprecated',
      'deprecatedAt',
    ];

    const data: any = {};

    // Copy all fields except excluded ones
    for (const [key, value] of Object.entries(source)) {
      if (!excludeFields.includes(key)) {
        // Sanitize componentAssignments for workflows
        if (key === 'componentAssignments' && entityType === 'workflow' && Array.isArray(value)) {
          // Keep only valid fields per ComponentAssignmentDto schema
          // Also handle legacy data format that may have 'role' field and missing version fields
          data[key] = value.map((assignment: any) => {
            // Parse version string to extract major/minor if not present
            let versionMajor = assignment.versionMajor;
            let versionMinor = assignment.versionMinor;

            if (assignment.version && (versionMajor === undefined || versionMinor === undefined)) {
              const match = assignment.version.match(/^v?(\d+)\.(\d+)$/);
              if (match) {
                versionMajor = parseInt(match[1], 10);
                versionMinor = parseInt(match[2], 10);
              }
            }

            return {
              componentName: assignment.componentName,
              componentId: assignment.componentId,
              versionId: assignment.versionId || assignment.componentId, // Fallback to componentId if versionId missing
              version: assignment.version,
              versionMajor: versionMajor || 1,
              versionMinor: versionMinor || 0,
            };
          });
        } else {
          data[key] = value;
        }
      }
    }

    // Set versioning fields
    return {
      ...data,
      ...versionFields,
      isDeprecated: false,
      deprecatedAt: null,
    };
  }
}
