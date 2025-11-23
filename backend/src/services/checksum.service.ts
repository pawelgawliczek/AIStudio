import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidationResult {
  match: boolean;
  expected: string | null;
  actual: string;
}

export interface ChecksumResult {
  instructionsChecksum: string;
  configChecksum: string;
}

export interface ChangeDetectionReport {
  changed: boolean;
  details?: string;
}

@Injectable()
export class ChecksumService {
  constructor(private prisma?: PrismaService) {}

  /**
   * Normalize whitespace: trim + collapse multiple spaces/tabs/newlines
   */
  private normalizeWhitespace(text: string): string {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Calculate MD5 hash and return hex string
   */
  private md5(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Deterministic JSON stringify with sorted keys (deep sort)
   */
  private sortedJsonStringify(obj: Record<string, unknown>): string {
    if (!obj || typeof obj !== 'object') return '{}';

    const sortKeys = (o: unknown): unknown => {
      if (o === null || typeof o !== 'object') return o;
      if (Array.isArray(o)) return o.map(sortKeys);
      const sorted: Record<string, unknown> = {};
      Object.keys(o as Record<string, unknown>).sort().forEach(key => {
        sorted[key] = sortKeys((o as Record<string, unknown>)[key]);
      });
      return sorted;
    };

    return JSON.stringify(sortKeys(obj));
  }

  /**
   * Calculate checksum for component instructions (input, operation, output)
   * TC-CHECKSUM-001: Must be deterministic
   * TC-CHECKSUM-002: Must normalize whitespace
   */
  calculateInstructionChecksum(input: string, operation: string, output: string): string {
    const normalized = [input, operation, output]
      .map(s => this.normalizeWhitespace(s || ''))
      .join('|');
    return this.md5(normalized);
  }

  /**
   * Generic checksum calculation for any data object
   * Used by versioning controller for flexibility
   */
  calculateChecksum(data: any): string {
    if (typeof data === 'string') {
      return this.md5(this.normalizeWhitespace(data));
    }
    return this.md5(this.sortedJsonStringify(data));
  }

  /**
   * Calculate checksum for config object
   * TC-CHECKSUM-003: Must be deterministic with key ordering
   */
  calculateConfigChecksum(config: Record<string, unknown>): string {
    return this.md5(this.sortedJsonStringify(config || {}));
  }

  /**
   * Validate runtime checksum against stored checksum
   * TC-CHECKSUM-004: Must return proper result structure
   * TC-CHECKSUM-005: Must be non-blocking (doesn't throw)
   */
  async validateRuntimeChecksum(componentId: string, runtimeChecksum: string): Promise<ValidationResult> {
    if (!this.prisma) {
      throw new Error('PrismaClient not initialized');
    }
    try {
      const component = await this.prisma.component.findUnique({
        where: { id: componentId }
      });

      if (!component) {
        return { match: false, expected: null, actual: runtimeChecksum };
      }

      // If no stored checksum yet, consider it a match (first run)
      if (!component.instructionsChecksum) {
        return { match: true, expected: null, actual: runtimeChecksum };
      }

      return {
        match: component.instructionsChecksum === runtimeChecksum,
        expected: component.instructionsChecksum,
        actual: runtimeChecksum
      };
    } catch (error) {
      // Non-blocking: log error but return failure result
      console.warn(`[ChecksumService] Validation error for component ${componentId}:`, error);
      return { match: false, expected: null, actual: runtimeChecksum };
    }
  }

  /**
   * Update checksums for a component entity
   */
  async updateChecksums(entityType: 'component', entityId: string): Promise<ChecksumResult> {
    if (!this.prisma) {
      throw new Error('PrismaClient not initialized');
    }
    if (entityType !== 'component') {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const component = await this.prisma.component.findUnique({
      where: { id: entityId }
    });

    if (!component) {
      throw new Error(`Component ${entityId} not found`);
    }

    const instructionsChecksum = this.calculateInstructionChecksum(
      component.inputInstructions || '',
      component.operationInstructions || '',
      component.outputInstructions || ''
    );

    const configChecksum = this.calculateConfigChecksum(
      (component.config as Record<string, unknown>) || {}
    );

    await this.prisma.component.update({
      where: { id: entityId },
      data: { instructionsChecksum, configChecksum }
    });

    return { instructionsChecksum, configChecksum };
  }

  /**
   * Detect if component has been manually changed since last checksum update
   */
  async detectManualChanges(entityId: string): Promise<ChangeDetectionReport> {
    if (!this.prisma) {
      throw new Error('PrismaClient not initialized');
    }
    try {
      const component = await this.prisma.component.findUnique({
        where: { id: entityId }
      });

      if (!component) {
        return { changed: false, details: 'Component not found' };
      }

      // If no stored checksum, no change detection possible
      if (!component.instructionsChecksum) {
        return { changed: false, details: 'No baseline checksum stored' };
      }

      const currentInstructionsChecksum = this.calculateInstructionChecksum(
        component.inputInstructions || '',
        component.operationInstructions || '',
        component.outputInstructions || ''
      );

      if (component.instructionsChecksum !== currentInstructionsChecksum) {
        return {
          changed: true,
          details: 'Instructions have been modified since last checksum update'
        };
      }

      const currentConfigChecksum = this.calculateConfigChecksum(
        (component.config as Record<string, unknown>) || {}
      );

      if (component.configChecksum && component.configChecksum !== currentConfigChecksum) {
        return {
          changed: true,
          details: 'Config has been modified since last checksum update'
        };
      }

      return { changed: false };
    } catch (error) {
      console.warn(`[ChecksumService] Change detection error for ${entityId}:`, error);
      return { changed: false, details: `Error during detection: ${error}` };
    }
  }
}
