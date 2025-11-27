import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsController } from '../analytics.controller';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;

  const mockExecutionHistory = [
    {
      id: 'run-123',
      workflowRunId: 'workflow-run-123',
      workflowName: 'Test Workflow',
      status: 'completed' as const,
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T10:05:00Z',
      duration: 300,
      cost: 0.05,
      triggeredBy: 'test-user',
      context: {},
    },
  ];

  const mockComponentAnalytics = {
    versionId: 'component-123',
    version: '1.0',
    metrics: {
      totalExecutions: 10,
      successfulExecutions: 8,
      failedExecutions: 2,
      successRate: 80,
      avgDuration: 250,
      totalCost: 0.5,
      avgCost: 0.05,
    },
    workflowsUsing: [
      {
        workflowId: 'workflow-123',
        workflowName: 'Test Workflow',
        version: '1.0',
        lastUsed: '2024-01-01T10:00:00Z',
        executionCount: 5,
      },
    ],
    executionHistory: mockExecutionHistory,
    executionTrend: [
      {
        timestamp: '2024-01-01T00:00:00Z',
        value: 5,
        label: '2024-01-01',
      },
    ],
    costTrend: [
      {
        timestamp: '2024-01-01T00:00:00Z',
        value: 0.25,
        label: '2024-01-01',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: {
            getComponentAnalytics: jest.fn(),
            getComponentExecutionHistory: jest.fn(),
            getWorkflowsUsingComponent: jest.fn(),
            getCoordinatorAnalytics: jest.fn(),
            getCoordinatorExecutionHistory: jest.fn(),
            getWorkflowsUsingCoordinator: jest.fn(),
            getCoordinatorComponentUsage: jest.fn(),
            getWorkflowAnalytics: jest.fn(),
            getWorkflowExecutionHistory: jest.fn(),
            getWorkflowComponentBreakdown: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Component Analytics', () => {
    describe('getComponentAnalytics', () => {
      it('should return component analytics', async () => {
        jest
          .spyOn(analyticsService, 'getComponentAnalytics')
          .mockResolvedValue(mockComponentAnalytics);

        const result = await controller.getComponentAnalytics('component-123', {
          versionId: 'component-123',
          timeRange: '30d',
        });

        expect(result).toEqual(mockComponentAnalytics);
        expect(analyticsService.getComponentAnalytics).toHaveBeenCalledWith(
          'component-123',
          'component-123',
          '30d',
        );
      });
    });

    describe('getComponentExecutionHistory', () => {
      it('should return execution history', async () => {
        jest
          .spyOn(analyticsService, 'getComponentExecutionHistory')
          .mockResolvedValue(mockExecutionHistory);

        const result = await controller.getComponentExecutionHistory('component-123', {
          versionId: 'component-123',
          timeRange: '30d',
          limit: 100,
          offset: 0,
        });

        expect(result).toEqual(mockExecutionHistory);
        expect(analyticsService.getComponentExecutionHistory).toHaveBeenCalledWith(
          'component-123',
          'component-123',
          '30d',
          100,
          0,
        );
      });
    });

    describe('exportComponentAnalytics', () => {
      it('should export analytics as CSV', async () => {
        jest
          .spyOn(analyticsService, 'getComponentExecutionHistory')
          .mockResolvedValue(mockExecutionHistory);

        const result = await controller.exportComponentAnalytics('component-123', {
          format: 'csv',
          timeRange: '30d',
        });

        expect(result).toBeInstanceOf(StreamableFile);
        expect(analyticsService.getComponentExecutionHistory).toHaveBeenCalledWith(
          'component-123',
          undefined,
          '30d',
          1000,
          0,
        );
      });

      it('should export analytics as JSON', async () => {
        jest
          .spyOn(analyticsService, 'getComponentExecutionHistory')
          .mockResolvedValue(mockExecutionHistory);

        const result = await controller.exportComponentAnalytics('component-123', {
          format: 'json',
          timeRange: '30d',
        });

        expect(result).toBeInstanceOf(StreamableFile);
        expect(analyticsService.getComponentExecutionHistory).toHaveBeenCalledWith(
          'component-123',
          undefined,
          '30d',
          1000,
          0,
        );
      });
    });
  });

  describe('Coordinator Analytics', () => {
    describe('getCoordinatorAnalytics', () => {
      it('should return coordinator analytics', async () => {
        const mockCoordinatorAnalytics = {
          ...mockComponentAnalytics,
          componentUsage: [
            {
              componentId: 'component-123',
              componentName: 'Test Component',
              usageCount: 5,
            },
          ],
        };

        jest
          .spyOn(analyticsService, 'getCoordinatorAnalytics')
          .mockResolvedValue(mockCoordinatorAnalytics);

        const result = await controller.getCoordinatorAnalytics('coordinator-123', {
          versionId: 'coordinator-123',
          timeRange: '30d',
        });

        expect(result).toEqual(mockCoordinatorAnalytics);
        expect(analyticsService.getCoordinatorAnalytics).toHaveBeenCalledWith(
          'coordinator-123',
          'coordinator-123',
          '30d',
        );
      });
    });

    describe('getCoordinatorComponentUsage', () => {
      it('should return component usage for coordinator', async () => {
        const mockComponentUsage = [
          {
            componentId: 'component-123',
            componentName: 'Test Component',
            usageCount: 5,
          },
        ];

        jest
          .spyOn(analyticsService, 'getCoordinatorComponentUsage')
          .mockResolvedValue(mockComponentUsage);

        const result = await controller.getCoordinatorComponentUsage(
          'coordinator-123',
          'coordinator-123',
        );

        expect(result).toEqual(mockComponentUsage);
        expect(analyticsService.getCoordinatorComponentUsage).toHaveBeenCalledWith(
          'coordinator-123',
          'coordinator-123',
        );
      });
    });
  });

  describe('Workflow Analytics', () => {
    describe('getWorkflowAnalytics', () => {
      it('should return workflow analytics', async () => {
        const mockWorkflowAnalytics = {
          ...mockComponentAnalytics,
          componentBreakdown: [
            {
              componentId: 'component-123',
              componentName: 'Test Component',
              avgDuration: 250,
              avgCost: 0.05,
              failureRate: 20,
            },
          ],
        };

        jest
          .spyOn(analyticsService, 'getWorkflowAnalytics')
          .mockResolvedValue(mockWorkflowAnalytics);

        const result = await controller.getWorkflowAnalytics('workflow-123', {
          versionId: 'workflow-123',
          timeRange: '30d',
        });

        expect(result).toEqual(mockWorkflowAnalytics);
        expect(analyticsService.getWorkflowAnalytics).toHaveBeenCalledWith(
          'workflow-123',
          'workflow-123',
          '30d',
        );
      });
    });

    describe('getWorkflowComponentBreakdown', () => {
      it('should return component breakdown for workflow', async () => {
        const mockBreakdown = [
          {
            componentId: 'component-123',
            componentName: 'Test Component',
            avgDuration: 250,
            avgCost: 0.05,
            failureRate: 20,
          },
        ];

        jest
          .spyOn(analyticsService, 'getWorkflowComponentBreakdown')
          .mockResolvedValue(mockBreakdown);

        const result = await controller.getWorkflowComponentBreakdown(
          'workflow-123',
          'workflow-123',
        );

        expect(result).toEqual(mockBreakdown);
        expect(analyticsService.getWorkflowComponentBreakdown).toHaveBeenCalledWith(
          'workflow-123',
          'workflow-123',
        );
      });
    });
  });
});
