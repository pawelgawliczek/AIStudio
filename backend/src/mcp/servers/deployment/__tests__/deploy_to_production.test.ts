/**
 * Unit tests for deploy_to_production MCP tool - ST-77
 */

import { handler, DeployToProductionParams } from '../deploy_to_production';
import { ValidationError } from '../../../types';

// Mock DeploymentService
jest.mock('../../../../services/deployment.service', () => ({
  DeploymentService: jest.fn().mockImplementation(() => ({
    deployToProduction: jest.fn(),
  })),
}));

describe('deploy_to_production MCP tool', () => {
  let mockDeploymentService: any;

  beforeEach(() => {
    const { DeploymentService } = require('../../../../services/deployment.service');
    mockDeploymentService = new DeploymentService();
    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    it('should reject deployment without confirmDeploy flag (AC9)', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: false, // Missing confirmation
      };

      await expect(handler(params)).rejects.toThrow(
        'Production deployment requires explicit confirmation'
      );
    });

    it('should reject deployment with invalid UUID', async () => {
      const params: any = {
        storyId: 'invalid-uuid',
        prNumber: 42,
        confirmDeploy: true,
      };

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Invalid storyId format')
      );
    });

    it('should reject deployment with invalid PR number', async () => {
      const params: any = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: -1,
        confirmDeploy: true,
      };

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Invalid prNumber')
      );
    });

    it('should accept valid parameters', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeploymentService.deployToProduction.mockResolvedValue({
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

      const result = await handler(params);

      expect(result.success).toBe(true);
      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith({
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

      mockDeploymentService.deployToProduction.mockResolvedValue({
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

      const result = await handler(params);

      expect(result.success).toBe(true);
      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith(
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

      mockDeploymentService.deployToProduction.mockResolvedValue({
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

      const result = await handler(params);

      expect(result.success).toBe(true);
      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith(
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

      mockDeploymentService.deployToProduction.mockResolvedValue(mockResult);

      const result = await handler(params);

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

      mockDeploymentService.deployToProduction.mockResolvedValue(mockResult);

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('Failed to build frontend container')
      );
      expect(result.phases.rollback).toBeDefined();
      expect(result.phases.rollback?.success).toBe(true);
    });

    it('should handle validation errors (AC10)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeploymentService.deployToProduction.mockRejectedValue(
        new Error('Story ST-77 is not ready for production. Status: implementation')
      );

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('not ready for production')
      );
    });

    it('should handle PR approval errors (AC2)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeploymentService.deployToProduction.mockRejectedValue(
        new Error('PR #42 has no approvals. At least 1 approval required.')
      );

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('has no approvals')
      );
    });

    it('should handle deployment lock errors (AC1)', async () => {
      const params: DeployToProductionParams = {
        storyId: '905d1a9c-1337-4cf7-b7f6-72b55db9e336',
        prNumber: 42,
        confirmDeploy: true,
      };

      mockDeploymentService.deployToProduction.mockRejectedValue(
        new Error('Production deployment locked by other-user. Expires at ...')
      );

      const result = await handler(params);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('deployment locked')
      );
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

      mockDeploymentService.deployToProduction.mockResolvedValue({
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

      await handler(params);

      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith(
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

      mockDeploymentService.deployToProduction.mockResolvedValue({
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

      await handler(params);

      expect(mockDeploymentService.deployToProduction).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: 'claude-implementer',
        })
      );
    });
  });
});
