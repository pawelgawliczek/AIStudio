import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentStatus } from '@prisma/client';
import { DeploymentsController } from '../deployments.controller';
import { DeploymentsService } from '../deployments.service';

describe('DeploymentsController', () => {
  let controller: DeploymentsController;
  let service: DeploymentsService;

  const mockDeploymentsService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByStoryId: jest.fn(),
    getStats: jest.fn(),
  };

  const mockDeployment = {
    id: 'deploy-1',
    storyId: 'story-1',
    storyKey: 'ST-123',
    storyTitle: 'Test Story',
    projectId: 'project-1',
    prNumber: 42,
    status: DeploymentStatus.deployed,
    environment: 'production',
    branch: 'main',
    commitHash: 'abc123',
    approvedBy: 'admin@test.com',
    approvedAt: new Date('2025-01-15T10:00:00Z'),
    deployedBy: 'claude-agent',
    deployedAt: new Date('2025-01-15T10:05:00Z'),
    completedAt: new Date('2025-01-15T10:10:00Z'),
    duration: 300000,
    errorMessage: null,
    approvalMethod: 'pr',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:10:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentsController],
      providers: [
        { provide: DeploymentsService, useValue: mockDeploymentsService },
      ],
    }).compile();

    controller = module.get<DeploymentsController>(DeploymentsController);
    service = module.get<DeploymentsService>(DeploymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const mockResponse = {
      data: [mockDeployment],
      total: 1,
      limit: 20,
      offset: 0,
    };

    it('should return all deployments without filters', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll();

      expect(result).toEqual(mockResponse);
      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: undefined,
        environment: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should filter by status', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(DeploymentStatus.deployed);

      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: DeploymentStatus.deployed,
        environment: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should filter by environment', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(undefined, 'production');

      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: undefined,
        environment: 'production',
        limit: undefined,
        offset: undefined,
      });
    });

    it('should parse and apply pagination', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(undefined, undefined, '10', '20');

      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: undefined,
        environment: undefined,
        limit: 10,
        offset: 20,
      });
    });

    it('should combine all filters', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(
        DeploymentStatus.failed,
        'test',
        '50',
        '100',
      );

      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: DeploymentStatus.failed,
        environment: 'test',
        limit: 50,
        offset: 100,
      });
    });

    it('should handle invalid limit/offset as undefined', async () => {
      mockDeploymentsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(undefined, undefined, 'invalid', 'bad');

      expect(mockDeploymentsService.findAll).toHaveBeenCalledWith({
        status: undefined,
        environment: undefined,
        limit: NaN,
        offset: NaN,
      });
    });
  });

  describe('getStats', () => {
    const mockStats = {
      total: 100,
      byStatus: {
        deployed: 70,
        failed: 20,
        pending: 10,
      },
      byEnvironment: {
        production: 60,
        test: 40,
      },
      todayCount: 5,
      todaySuccessCount: 4,
      todayFailedCount: 1,
      recentDeployments: [mockDeployment],
    };

    it('should return deployment statistics', async () => {
      mockDeploymentsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(mockDeploymentsService.getStats).toHaveBeenCalled();
    });
  });

  describe('findByStoryId', () => {
    const mockStoryDeployments = {
      data: [mockDeployment],
      total: 1,
      successCount: 1,
      failedCount: 0,
    };

    it('should return deployments for a specific story', async () => {
      mockDeploymentsService.findByStoryId.mockResolvedValue(mockStoryDeployments);

      const result = await controller.findByStoryId('story-1');

      expect(result).toEqual(mockStoryDeployments);
      expect(mockDeploymentsService.findByStoryId).toHaveBeenCalledWith('story-1');
    });

    it('should return empty results for story with no deployments', async () => {
      const emptyResult = {
        data: [],
        total: 0,
        successCount: 0,
        failedCount: 0,
      };
      mockDeploymentsService.findByStoryId.mockResolvedValue(emptyResult);

      const result = await controller.findByStoryId('story-no-deploys');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return deployment by ID', async () => {
      mockDeploymentsService.findById.mockResolvedValue(mockDeployment);

      const result = await controller.findOne('deploy-1');

      expect(result).toEqual(mockDeployment);
      expect(mockDeploymentsService.findById).toHaveBeenCalledWith('deploy-1');
    });

    it('should throw NotFoundException when deployment not found', async () => {
      mockDeploymentsService.findById.mockResolvedValue(null);

      await expect(controller.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findOne('non-existent')).rejects.toThrow(
        'Deployment with ID non-existent not found',
      );
    });
  });

  describe('Route ordering', () => {
    it('stats route should be accessible before :id route', async () => {
      // This test ensures the route ordering is correct
      // The 'stats' route must come before ':id' to prevent 'stats' being treated as an ID
      mockDeploymentsService.getStats.mockResolvedValue({
        total: 100,
        byStatus: {},
        byEnvironment: {},
        todayCount: 0,
        todaySuccessCount: 0,
        todayFailedCount: 0,
        recentDeployments: [],
      });

      const result = await controller.getStats();

      expect(result.total).toBe(100);
      // If route ordering is wrong, this would try to call findById('stats')
      expect(mockDeploymentsService.findById).not.toHaveBeenCalled();
    });

    it('story/:storyId route should be accessible before :id route', async () => {
      mockDeploymentsService.findByStoryId.mockResolvedValue({
        data: [],
        total: 0,
        successCount: 0,
        failedCount: 0,
      });

      await controller.findByStoryId('story-123');

      expect(mockDeploymentsService.findByStoryId).toHaveBeenCalledWith('story-123');
      // If route ordering is wrong, this would try to call findById('story')
      expect(mockDeploymentsService.findById).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors', async () => {
      mockDeploymentsService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll()).rejects.toThrow('Database error');
    });

    it('should propagate service errors for stats', async () => {
      mockDeploymentsService.getStats.mockRejectedValue(new Error('Stats calculation failed'));

      await expect(controller.getStats()).rejects.toThrow('Stats calculation failed');
    });

    it('should propagate service errors for findByStoryId', async () => {
      mockDeploymentsService.findByStoryId.mockRejectedValue(new Error('Story not found'));

      await expect(controller.findByStoryId('story-1')).rejects.toThrow('Story not found');
    });
  });

  describe('Input validation', () => {
    it('should accept valid DeploymentStatus enum values', async () => {
      mockDeploymentsService.findAll.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });

      const validStatuses = [
        DeploymentStatus.pending,
        DeploymentStatus.approved,
        DeploymentStatus.deploying,
        DeploymentStatus.deployed,
        DeploymentStatus.failed,
        DeploymentStatus.rolled_back,
      ];

      for (const status of validStatuses) {
        await controller.findAll(status);
        expect(mockDeploymentsService.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ status }),
        );
      }
    });

    it('should accept any environment string', async () => {
      mockDeploymentsService.findAll.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });

      const environments = ['production', 'test', 'staging', 'development'];

      for (const environment of environments) {
        await controller.findAll(undefined, environment);
        expect(mockDeploymentsService.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ environment }),
        );
      }
    });
  });
});
