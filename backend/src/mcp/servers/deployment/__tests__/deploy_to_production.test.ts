/**
 * Unit tests for deploy_to_production MCP tool - ST-77, ST-84
 */

import { PrismaClient } from '@prisma/client';
import { DeploymentService } from '../../../../services/deployment.service';
import { ValidationError } from '../../../types';
import { handler, DeployToProductionParams } from '../deploy_to_production';

// Mock the DeploymentService module
jest.mock('../../../../services/deployment.service');

// Mock PrismaClient
const mockPrisma = {} as PrismaClient;

describe('deploy_to_production MCP tool', () => {
  let mockDeployToProduction: jest.Mock;

  beforeEach(() => {
    // Create mock implementation
    mockDeployToProduction = jest.fn();

    // Mock the DeploymentService constructor and methods
    (DeploymentService as jest.MockedClass<typeof DeploymentService>).mockImplementation(() => ({
      deployToProduction: mockDeployToProduction,
      getDeploymentHistory: jest.fn(),
      getCurrentDeployment: jest.fn(),
    } as any));

    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    it('should reject deployment without confirmDeploy flag (AC9)', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: false, // Missing confirmation (false is falsy, so validateRequired will catch it)
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('confirmDeploy'))).toBe(true);
    });

    it('should reject deployment with invalid UUID', async () => {
      const params: any = {
        storyId: 'invalid-uuid',
        prNumber: 42,
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid storyId format'))).toBe(true);
    });

    it('should reject deployment with invalid PR number', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: -1,
        confirmDeploy: true,
      };

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid prNumber'))).toBe(true);
    });

    it('should accept valid parameters', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId: 'log-123',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 600000,
        phases: {
          validation: { success: true, duration: 1000 },
          lockAcquisition: { success: true, duration: 500 },
          backup: { success: true, duration: 30000 },
          buildBackend: { success: true, duration: 120000 },
          buildFrontend: { success: true, duration: 90000 },
          restartBackend: { success: true, duration: 10000 },
          restartFrontend: { success: true, duration: 10000 },
          healthChecks: { success: true, duration: 60000 },
          lockRelease: { success: true, duration: 500 },
        },
        warnings: [],
        errors: [],
        message: 'Deployment successful',
      });

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(mockDeployToProduction).toHaveBeenCalledWith({
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'mcp-user',
        skipBackup: false,
        skipHealthChecks: false,
      });
    });
  });

  describe('Emergency Mode', () => {
    it('should pass skipBackup flag to deployment service', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
        skipBackup: true, // Emergency mode
      };

      mockDeployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId: 'log-123',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 500000,
        phases: {},
        warnings: ['Backup skipped'],
        errors: [],
        message: 'Emergency deployment successful',
      });

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(mockDeployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          skipBackup: true,
        })
      );
    });

    it('should pass skipHealthChecks flag to deployment service', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
        skipHealthChecks: true, // Emergency mode
      };

      mockDeployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId: 'log-123',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 480000,
        phases: {},
        warnings: ['Health checks skipped'],
        errors: [],
        message: 'Emergency deployment successful',
      });

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(mockDeployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          skipHealthChecks: true,
        })
      );
    });
  });

  describe('Successful Deployment', () => {
    it('should return deployment result with all phases', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'test-user',
        confirmDeploy: true,
      };

      const mockResult = {
        success: true,
        deploymentLogId: 'log-456',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 720000,
        lockId: 'lock-789',
        backupFile: '/backups/vibestudio_pre_deployment_ST-77-PR-42_20251122.dump',
        healthCheckResults: {
          backend: {
            success: true,
            consecutiveSuccesses: 3,
            url: 'http://localhost:3000/health',
            latency: 150,
          },
          frontend: {
            success: true,
            consecutiveSuccesses: 3,
            url: 'http://localhost:5173',
            latency: 80,
          },
        },
        phases: {
          validation: { success: true, duration: 2000 },
          lockAcquisition: { success: true, duration: 800 },
          backup: { success: true, duration: 45000 },
          buildBackend: { success: true, duration: 180000 },
          buildFrontend: { success: true, duration: 120000 },
          restartBackend: { success: true, duration: 15000 },
          restartFrontend: { success: true, duration: 12000 },
          healthChecks: { success: true, duration: 65000 },
          lockRelease: { success: true, duration: 600 },
        },
        warnings: [],
        errors: [],
        message: 'Production deployment successful for ST-77 (PR #42)',
      };

      mockDeployToProduction.mockResolvedValue(mockResult);

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(true);
      expect(result.deploymentLogId).toBe('log-456');
      expect(result.storyKey).toBe('ST-77');
      expect(result.prNumber).toBe(42);
      expect(result.lockId).toBe('lock-789');
      expect(result.backupFile).toContain('vibestudio_pre_deployment');
      expect(result.healthCheckResults).toBeDefined();
      expect(result.healthCheckResults?.backend.consecutiveSuccesses).toBe(3);
      expect(result.healthCheckResults?.frontend.consecutiveSuccesses).toBe(3);
    });
  });

  describe('Failed Deployment', () => {
    it('should return error result when deployment fails', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      const mockResult = {
        success: false,
        deploymentLogId: 'log-999',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 180000,
        lockId: 'lock-111',
        backupFile: '/backups/vibestudio_pre_deployment_ST-77.dump',
        phases: {
          validation: { success: true, duration: 1000 },
          lockAcquisition: { success: true, duration: 500 },
          backup: { success: true, duration: 30000 },
          buildBackend: { success: true, duration: 120000 },
          buildFrontend: { success: false, duration: 90000, error: 'Build failed' },
          restartBackend: { success: false, duration: 0 },
          restartFrontend: { success: false, duration: 0 },
          healthChecks: { success: false, duration: 0 },
          lockRelease: { success: true, duration: 500 },
          rollback: { success: true, duration: 25000, message: 'Rollback successful' },
        },
        warnings: ['Automatic rollback completed'],
        errors: ['Failed to build frontend container: Build error'],
        message: 'Deployment failed: Build error',
      };

      mockDeployToProduction.mockResolvedValue(mockResult);

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to build frontend container'))).toBe(true);
      expect(result.phases.rollback).toBeDefined();
      expect(result.phases.rollback?.success).toBe(true);
    });

    it('should handle validation errors (AC10)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeployToProduction.mockRejectedValue(
        new Error('Story ST-77 is not ready for production. Status: implementation')
      );

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('not ready for production'))).toBe(true);
    });

    it('should handle PR approval errors (AC2)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeployToProduction.mockRejectedValue(
        new Error('PR #42 has no approvals. At least 1 approval required.')
      );

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('has no approvals'))).toBe(true);
    });

    it('should handle deployment lock errors (AC1)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeployToProduction.mockRejectedValue(
        new Error('Production deployment locked by other-user. Expires at ...')
      );

      const result = await handler(mockPrisma, params);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('deployment locked'))).toBe(true);
    });
  });

  describe('triggeredBy Parameter', () => {
    it('should default to mcp-user if not provided', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
        // triggeredBy not provided
      };

      mockDeployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId: 'log-123',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 600000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      });

      await handler(mockPrisma, params);

      expect(mockDeployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: 'mcp-user',
        })
      );
    });

    it('should use custom triggeredBy value if provided', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        triggeredBy: 'claude-implementer',
        confirmDeploy: true,
      };

      mockDeployToProduction.mockResolvedValue({
        success: true,
        deploymentLogId: 'log-123',
        storyKey: 'ST-77',
        prNumber: 42,
        duration: 600000,
        phases: {},
        warnings: [],
        errors: [],
        message: 'Success',
      });

      await handler(mockPrisma, params);

      expect(mockDeployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: 'claude-implementer',
        })
      );
    });
  });

  describe('ST-84: Direct Commit Mode', () => {
    describe('AC8: Mutual Exclusivity', () => {
      it('should reject deployment with both prNumber and directCommit', async () => {
        const params: any = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          prNumber: 42,
          directCommit: true, // Both provided - should fail
          confirmDeploy: true,
        };

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('Cannot use both prNumber and directCommit'))).toBe(true);
      });

      it('should reject deployment with neither prNumber nor directCommit', async () => {
        const params: any = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          // Neither prNumber nor directCommit provided
          confirmDeploy: true,
        };

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('Must provide either prNumber'))).toBe(true);
      });
    });

    describe('AC7: Backward Compatibility', () => {
      it('should still work with PR mode (existing behavior)', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-123',
          storyKey: 'ST-77',
          prNumber: 42,
          duration: 600000,
          phases: {
            validation: { success: true, duration: 1000 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 120000 },
            buildFrontend: { success: true, duration: 90000 },
            restartBackend: { success: true, duration: 10000 },
            restartFrontend: { success: true, duration: 10000 },
            healthChecks: { success: true, duration: 60000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: [],
          errors: [],
          message: 'Deployment successful',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.prNumber).toBe(42);
        expect(result.directCommit).toBeUndefined();

        // Verify service was called with PR mode params
        expect(mockDeployToProduction).toHaveBeenCalledWith({
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          directCommit: undefined,
          triggeredBy: 'mcp-user',
          skipBackup: false,
          skipHealthChecks: false,
        });
      });
    });

    describe('AC1: Direct Commit Support', () => {
      it('should accept deployment with directCommit=true', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-456',
          storyKey: 'ST-84',
          directCommit: true,
          commitHash: 'abc1234',
          duration: 620000,
          phases: {
            validation: { success: true, duration: 1500 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 125000 },
            buildFrontend: { success: true, duration: 95000 },
            restartBackend: { success: true, duration: 12000 },
            restartFrontend: { success: true, duration: 11000 },
            healthChecks: { success: true, duration: 62000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: [],
          errors: [],
          message: 'Production deployment successful for ST-84 (direct commit: abc1234)',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.directCommit).toBe(true);
        expect(result.commitHash).toBe('abc1234');
        expect(result.prNumber).toBeUndefined();

        // Verify service was called with direct commit mode params
        expect(mockDeployToProduction).toHaveBeenCalledWith({
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          prNumber: undefined,
          directCommit: true,
          triggeredBy: 'mcp-user',
          skipBackup: false,
          skipHealthChecks: false,
        });
      });

      it('should pass directCommit flag to deployment service', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          triggeredBy: 'claude-agent',
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-789',
          storyKey: 'ST-84',
          directCommit: true,
          commitHash: 'def5678',
          duration: 610000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            directCommit: true,
            prNumber: undefined,
          })
        );
      });
    });

    describe('Direct Commit Failure Scenarios', () => {
      it('should handle missing manual approval error (AC3)', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockRejectedValue(
          new Error('Story ST-84 does not have manual approval. Use approve_deployment tool before deploying.')
        );

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('does not have manual approval'))).toBe(true);
      });

      it('should handle expired approval error (AC4)', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockRejectedValue(
          new Error('Manual approval for story ST-84 has expired. Use approve_deployment tool to renew approval.')
        );

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('has expired'))).toBe(true);
      });

      it('should handle commit validation error (AC2)', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockRejectedValue(
          new Error('Commit validation failed: Commit abc1234 is not on main branch.')
        );

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('Commit validation failed'))).toBe(true);
      });
    });

    describe('Direct Commit with Emergency Options', () => {
      it('should support skipBackup with directCommit mode', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          skipBackup: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-emergency-1',
          storyKey: 'ST-84',
          directCommit: true,
          commitHash: 'xyz9999',
          duration: 450000,
          phases: {},
          warnings: ['Backup skipped'],
          errors: [],
          message: 'Emergency deployment successful',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.warnings).toContain('Backup skipped');
        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            directCommit: true,
            skipBackup: true,
          })
        );
      });

      it('should support skipHealthChecks with directCommit mode', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          skipHealthChecks: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-emergency-2',
          storyKey: 'ST-84',
          directCommit: true,
          commitHash: 'uvw7777',
          duration: 400000,
          phases: {},
          warnings: ['Health checks skipped'],
          errors: [],
          message: 'Emergency deployment successful',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.warnings).toContain('Health checks skipped');
        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            directCommit: true,
            skipHealthChecks: true,
          })
        );
      });
    });
  });

  // ==========================================================================
  // ST-115: Build Performance Optimization Tests
  // ==========================================================================

  describe('ST-115: Build Performance Optimization', () => {
    describe('useCache Parameter', () => {
      it('should default useCache to false for deterministic production builds', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          confirmDeploy: true,
          // useCache not provided - should default to false
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-1',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 600000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            useCache: false,
          })
        );
      });

      it('should pass useCache=true when explicitly set', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          useCache: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-2',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 480000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success with cache',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            useCache: true,
          })
        );
      });
    });

    describe('autoDetectBuilds Parameter', () => {
      it('should default autoDetectBuilds to false for explicit control', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          confirmDeploy: true,
          // autoDetectBuilds not provided - should default to false
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-3',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 600000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            autoDetectBuilds: false,
          })
        );
      });

      it('should pass autoDetectBuilds=true when explicitly set', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          autoDetectBuilds: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-4',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 300000, // Faster due to auto-detect
          phases: {},
          warnings: ['Skipping backend build (Frontend-only changes detected)'],
          errors: [],
          message: 'Success with auto-detect',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            autoDetectBuilds: true,
          })
        );
      });

      it('should support autoDetectBuilds with directCommit mode', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          autoDetectBuilds: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-5',
          storyKey: 'ST-115',
          directCommit: true,
          commitHash: 'abc1234',
          duration: 280000,
          phases: {},
          warnings: ['Skipping frontend build (Backend-only changes detected)'],
          errors: [],
          message: 'Success with auto-detect',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            directCommit: true,
            autoDetectBuilds: true,
          })
        );
      });
    });

    describe('skipBackendBuild Parameter', () => {
      it('should default skipBackendBuild to false', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-6',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 600000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            skipBackendBuild: false,
          })
        );
      });

      it('should pass skipBackendBuild=true for frontend-only changes', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          skipBackendBuild: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-7',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 180000, // Faster without backend build
          phases: {
            validation: { success: true, duration: 1000 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 0, message: 'Skipped' },
            buildFrontend: { success: true, duration: 90000 },
            restartBackend: { success: true, duration: 5000 },
            restartFrontend: { success: true, duration: 10000 },
            healthChecks: { success: true, duration: 60000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: [],
          errors: [],
          message: 'Success (backend build skipped)',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.duration).toBe(180000);
        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            skipBackendBuild: true,
          })
        );
      });
    });

    describe('skipFrontendBuild Parameter', () => {
      it('should default skipFrontendBuild to false', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-8',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 600000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            skipFrontendBuild: false,
          })
        );
      });

      it('should pass skipFrontendBuild=true for backend-only changes', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          skipFrontendBuild: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-9',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 250000, // Faster without frontend build
          phases: {
            validation: { success: true, duration: 1000 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 120000 },
            buildFrontend: { success: true, duration: 0, message: 'Skipped' },
            restartBackend: { success: true, duration: 10000 },
            restartFrontend: { success: true, duration: 5000 },
            healthChecks: { success: true, duration: 60000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: [],
          errors: [],
          message: 'Success (frontend build skipped)',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.duration).toBe(250000);
        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            skipFrontendBuild: true,
          })
        );
      });
    });

    describe('Combined Optimization Parameters', () => {
      it('should support all optimization params together', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          useCache: true,
          autoDetectBuilds: true,
          skipBackendBuild: false,
          skipFrontendBuild: false,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-10',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 400000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            useCache: true,
            autoDetectBuilds: true,
            skipBackendBuild: false,
            skipFrontendBuild: false,
          })
        );
      });

      it('should allow manual skip flags to override autoDetectBuilds', async () => {
        // When skipBackendBuild is explicitly true, it should be passed even with autoDetectBuilds
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          autoDetectBuilds: true,
          skipBackendBuild: true, // Explicit override
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-11',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 200000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            autoDetectBuilds: true,
            skipBackendBuild: true,
          })
        );
      });

      it('should support docs-only deployment (skip both builds)', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          autoDetectBuilds: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-12',
          storyKey: 'ST-115',
          prNumber: 42,
          duration: 90000, // Very fast - no builds
          phases: {
            validation: { success: true, duration: 1000 },
            lockAcquisition: { success: true, duration: 500 },
            backup: { success: true, duration: 30000 },
            buildBackend: { success: true, duration: 0, message: 'Skipped (docs-only changes)' },
            buildFrontend: { success: true, duration: 0, message: 'Skipped (docs-only changes)' },
            restartBackend: { success: true, duration: 0, message: 'Skipped' },
            restartFrontend: { success: true, duration: 0, message: 'Skipped' },
            healthChecks: { success: true, duration: 30000 },
            lockRelease: { success: true, duration: 500 },
          },
          warnings: ['No code changes detected (docs-only), skipping builds'],
          errors: [],
          message: 'Success (docs-only deployment)',
        });

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(true);
        expect(result.duration).toBe(90000);
        expect(result.warnings).toContain('No code changes detected (docs-only), skipping builds');
      });
    });

    describe('Optimization with Direct Commit Mode', () => {
      it('should support all ST-115 params with directCommit mode', async () => {
        const params: DeployToProductionParams = {
          storyId: '2e809be4-cc67-4fc7-8c3d-4d337c0043d5',
          directCommit: true,
          useCache: true,
          autoDetectBuilds: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockResolvedValue({
          success: true,
          deploymentLogId: 'log-115-13',
          storyKey: 'ST-115',
          directCommit: true,
          commitHash: 'def5678',
          duration: 250000,
          phases: {},
          warnings: [],
          errors: [],
          message: 'Success',
        });

        await handler(mockPrisma, params);

        expect(mockDeployToProduction).toHaveBeenCalledWith(
          expect.objectContaining({
            directCommit: true,
            useCache: true,
            autoDetectBuilds: true,
          })
        );
      });
    });

    describe('Optimization Error Scenarios', () => {
      it('should handle build decision service errors gracefully', async () => {
        const params: DeployToProductionParams = {
          storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
          prNumber: 42,
          autoDetectBuilds: true,
          confirmDeploy: true,
        };

        mockDeployToProduction.mockRejectedValue(
          new Error('Build decision failed: Git repository not found')
        );

        const result = await handler(mockPrisma, params);

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes('Build decision failed'))).toBe(true);
      });
    });
  });
});
