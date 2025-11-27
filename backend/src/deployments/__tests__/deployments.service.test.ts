import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentsService } from '../deployments.service';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    deploymentLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockStory = {
    id: 'story-1',
    key: 'ST-123',
    title: 'Test Story',
    projectId: 'project-1',
  };

  const mockDeployment = {
    id: 'deploy-1',
    storyId: 'story-1',
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
    errorMessage: null,
    approvalMethod: 'pr',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:10:00Z'),
    story: mockStory,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated deployments with default limit', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      await service.findAll({ status: DeploymentStatus.deployed });

      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: DeploymentStatus.deployed },
        }),
      );
    });

    it('should filter by environment', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      await service.findAll({ environment: 'production' });

      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { environment: 'production' },
        }),
      );
    });

    it('should filter by storyId', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      await service.findAll({ storyId: 'story-1' });

      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storyId: 'story-1' },
        }),
      );
    });

    it('should apply custom pagination', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(50);

      const result = await service.findAll({ limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should combine multiple filters', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      await service.findAll({
        status: DeploymentStatus.failed,
        environment: 'test',
        storyId: 'story-2',
      });

      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: DeploymentStatus.failed,
            environment: 'test',
            storyId: 'story-2',
          },
        }),
      );
    });

    it('should format deployment with duration calculation', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([mockDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data[0]).toMatchObject({
        id: 'deploy-1',
        storyKey: 'ST-123',
        storyTitle: 'Test Story',
        projectId: 'project-1',
        status: DeploymentStatus.deployed,
        environment: 'production',
      });
      // Duration = completedAt - deployedAt = 5 minutes = 300000ms
      expect(result.data[0].duration).toBe(300000);
    });

    it('should handle deployment without story', async () => {
      const deploymentWithoutStory = { ...mockDeployment, story: null };
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([deploymentWithoutStory]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data[0].storyKey).toBeNull();
      expect(result.data[0].storyTitle).toBeNull();
      expect(result.data[0].projectId).toBeNull();
    });

    it('should handle deployment without completion time', async () => {
      const incompleteDeployment = { ...mockDeployment, completedAt: null };
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([incompleteDeployment]);
      mockPrismaService.deploymentLog.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.data[0].duration).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return deployment by ID', async () => {
      mockPrismaService.deploymentLog.findUnique.mockResolvedValue(mockDeployment);

      const result = await service.findById('deploy-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('deploy-1');
      expect(result.storyKey).toBe('ST-123');
      expect(mockPrismaService.deploymentLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'deploy-1' },
        include: expect.any(Object),
      });
    });

    it('should return null for non-existent deployment', async () => {
      mockPrismaService.deploymentLog.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByStoryId', () => {
    const mockDeployments = [
      { ...mockDeployment, id: 'deploy-1', status: DeploymentStatus.deployed },
      { ...mockDeployment, id: 'deploy-2', status: DeploymentStatus.failed },
      { ...mockDeployment, id: 'deploy-3', status: DeploymentStatus.rolled_back },
      { ...mockDeployment, id: 'deploy-4', status: DeploymentStatus.deployed },
    ];

    it('should return all deployments for a story', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue(mockDeployments);

      const result = await service.findByStoryId('story-1');

      expect(result.data).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(mockPrismaService.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { storyId: 'story-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should calculate success count correctly', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue(mockDeployments);

      const result = await service.findByStoryId('story-1');

      expect(result.successCount).toBe(2); // 2 deployed
    });

    it('should calculate failed count correctly', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue(mockDeployments);

      const result = await service.findByStoryId('story-1');

      expect(result.failedCount).toBe(2); // 1 failed + 1 rolled_back
    });

    it('should handle story with no deployments', async () => {
      mockPrismaService.deploymentLog.findMany.mockResolvedValue([]);

      const result = await service.findByStoryId('story-no-deploys');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      mockPrismaService.deploymentLog.count.mockResolvedValue(100);
      mockPrismaService.deploymentLog.groupBy
        .mockResolvedValueOnce([
          { status: DeploymentStatus.deployed, _count: 70 },
          { status: DeploymentStatus.failed, _count: 20 },
          { status: DeploymentStatus.pending, _count: 10 },
        ])
        .mockResolvedValueOnce([
          { environment: 'production', _count: 60 },
          { environment: 'test', _count: 40 },
        ]);
      mockPrismaService.deploymentLog.findMany
        .mockResolvedValueOnce([
          { status: DeploymentStatus.deployed },
          { status: DeploymentStatus.deployed },
          { status: DeploymentStatus.failed },
        ])
        .mockResolvedValueOnce([mockDeployment]);
    });

    it('should return total deployment count', async () => {
      const result = await service.getStats();

      expect(result.total).toBe(100);
    });

    it('should return deployments grouped by status', async () => {
      const result = await service.getStats();

      expect(result.byStatus).toEqual({
        deployed: 70,
        failed: 20,
        pending: 10,
      });
    });

    it('should return deployments grouped by environment', async () => {
      const result = await service.getStats();

      expect(result.byEnvironment).toEqual({
        production: 60,
        test: 40,
      });
    });

    it('should calculate today counts', async () => {
      const result = await service.getStats();

      expect(result.todayCount).toBe(3);
      expect(result.todaySuccessCount).toBe(2);
      expect(result.todayFailedCount).toBe(1);
    });

    it('should return recent deployments', async () => {
      const result = await service.getStats();

      expect(result.recentDeployments).toHaveLength(1);
      expect(result.recentDeployments[0].id).toBe('deploy-1');
    });

    it('should query for today deployments with correct date filter', async () => {
      await service.getStats();

      // Verify the today query uses a date filter
      const todayQueryCall = mockPrismaService.deploymentLog.findMany.mock.calls[0];
      expect(todayQueryCall[0].where.createdAt).toBeDefined();
      expect(todayQueryCall[0].where.createdAt.gte).toBeInstanceOf(Date);
    });

    it('should limit recent deployments to 5', async () => {
      await service.getStats();

      const recentQueryCall = mockPrismaService.deploymentLog.findMany.mock.calls[1];
      expect(recentQueryCall[0].take).toBe(5);
    });
  });

  describe('formatDeployment (private method via public methods)', () => {
    it('should include all required fields', async () => {
      mockPrismaService.deploymentLog.findUnique.mockResolvedValue(mockDeployment);

      const result = await service.findById('deploy-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('storyTitle');
      expect(result).toHaveProperty('projectId');
      expect(result).toHaveProperty('prNumber');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('branch');
      expect(result).toHaveProperty('commitHash');
      expect(result).toHaveProperty('approvedBy');
      expect(result).toHaveProperty('approvedAt');
      expect(result).toHaveProperty('deployedBy');
      expect(result).toHaveProperty('deployedAt');
      expect(result).toHaveProperty('completedAt');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('errorMessage');
      expect(result).toHaveProperty('approvalMethod');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should calculate duration correctly', async () => {
      const deployment = {
        ...mockDeployment,
        deployedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:15:30Z'), // 15 min 30 sec later
      };
      mockPrismaService.deploymentLog.findUnique.mockResolvedValue(deployment);

      const result = await service.findById('deploy-1');

      // 15 min 30 sec = 930 seconds = 930000 ms
      expect(result.duration).toBe(930000);
    });

    it('should return null duration when deployedAt is missing', async () => {
      const deployment = {
        ...mockDeployment,
        deployedAt: null,
        completedAt: new Date('2025-01-15T10:15:30Z'),
      };
      mockPrismaService.deploymentLog.findUnique.mockResolvedValue(deployment);

      const result = await service.findById('deploy-1');

      expect(result.duration).toBeNull();
    });
  });
});
