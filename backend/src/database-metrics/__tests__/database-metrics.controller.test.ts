import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseMetricsController } from '../database-metrics.controller';
import { DatabaseMetricsService } from '../database-metrics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DatabaseMetricsController', () => {
  let controller: DatabaseMetricsController;
  let service: DatabaseMetricsService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseMetricsController],
      providers: [
        DatabaseMetricsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<DatabaseMetricsController>(DatabaseMetricsController);
    service = module.get<DatabaseMetricsService>(DatabaseMetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConnectionMetrics', () => {
    it('should return database metrics', async () => {
      const mockMetrics = {
        timestamp: new Date().toISOString(),
        pool_utilization: {
          total: 10,
          active: 5,
          idle: 5,
          pool_size: 50,
          utilization_percent: 20,
        },
        connection_states: [
          { state: 'active', count: 5 },
          { state: 'idle', count: 5 },
        ],
        connection_details: [],
        oldest_connection_age_seconds: 3600,
      };

      jest.spyOn(service, 'getConnectionMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getConnectionMetrics();

      expect(result).toEqual(mockMetrics);
      expect(service.getConnectionMetrics).toHaveBeenCalled();
    });
  });
});
