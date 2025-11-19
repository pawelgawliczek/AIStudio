/**
 * Unit tests for ValidationService
 */

import { ValidationService } from '../validation.service';
import { PrismaClient } from '@prisma/client';
import { dockerExec } from '../../utils/docker-exec.util';
import { ValidationLevel } from '../../types/migration.types';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../utils/docker-exec.util');

const mockDockerExec = dockerExec as jest.MockedFunction<typeof dockerExec>;

describe('ValidationService', () => {
  let validationService: ValidationService;
  let mockPrisma: any;

  beforeEach(() => {
    validationService = new ValidationService();
    const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
    mockPrisma = new PrismaClientMock();
    jest.clearAllMocks();
  });

  describe('validateSchema', () => {
    it('should validate schema successfully', async () => {
      // Mock docker exec calls for table count, critical tables, indexes, and FK constraints
      mockDockerExec
        .mockResolvedValueOnce({ success: true, stdout: '30', stderr: '', exitCode: 0 }) // table count
        .mockResolvedValue({ success: true, stdout: 't', stderr: '', exitCode: 0 }); // all tables exist

      const result = await validationService.validateSchema();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.SCHEMA);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should fail if tables are missing', async () => {
      mockDockerExec.mockResolvedValue({ success: true, stdout: '0', stderr: '', exitCode: 0 });

      const result = await validationService.validateSchema();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateDataIntegrity', () => {
    it('should validate data integrity successfully', async () => {
      // Mock Prisma methods
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ count: BigInt(0) }]);

      const result = await validationService.validateDataIntegrity();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.DATA_INTEGRITY);
    });

    it('should detect data integrity violations', async () => {
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ count: BigInt(5) }]); // violations found

      const result = await validationService.validateDataIntegrity();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateHealth', () => {
    it('should run all health checks successfully', async () => {
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ count: BigInt(1) }]);
      mockPrisma.project = { count: jest.fn().mockResolvedValue(10) };
      mockPrisma.story = { count: jest.fn().mockResolvedValue(50) };

      const result = await validationService.validateHealth();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.HEALTH);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should detect unhealthy database', async () => {
      mockPrisma.$connect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await validationService.validateHealth();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('runSmokeTests', () => {
    it('should run smoke tests successfully', async () => {
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.project = { findMany: jest.fn().mockResolvedValue([{ id: '1', name: 'Test' }]) };
      mockPrisma.story = { findMany: jest.fn().mockResolvedValue([]) };
      mockPrisma.useCase = { findMany: jest.fn().mockResolvedValue([]) };
      mockPrisma.workflow = { findMany: jest.fn().mockResolvedValue([]) };

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(true);
      expect(result.level).toBe(ValidationLevel.SMOKE_TESTS);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should detect failed smoke tests', async () => {
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.project = { findMany: jest.fn().mockRejectedValue(new Error('Query failed')) };

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateAll', () => {
    it('should run all validation levels successfully', async () => {
      // Mock all docker exec calls for schema validation
      mockDockerExec.mockResolvedValue({ success: true, stdout: 't', stderr: '', exitCode: 0 });

      // Mock Prisma for data integrity, health, and smoke tests
      mockPrisma.$connect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$disconnect = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ count: BigInt(0) }]);
      mockPrisma.project = {
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([{ id: '1', name: 'Test' }]),
      };
      mockPrisma.story = {
        count: jest.fn().mockResolvedValue(50),
        findMany: jest.fn().mockResolvedValue([]),
      };
      mockPrisma.useCase = { findMany: jest.fn().mockResolvedValue([]) };
      mockPrisma.workflow = { findMany: jest.fn().mockResolvedValue([]) };

      const result = await validationService.validateAll();

      expect(result.schema.passed).toBe(true);
      expect(result.dataIntegrity?.passed).toBe(true);
      expect(result.health?.passed).toBe(true);
      expect(result.smokeTests?.passed).toBe(true);
    });

    it('should stop validation if schema fails', async () => {
      mockDockerExec.mockResolvedValue({ success: true, stdout: '0', stderr: '', exitCode: 0 });

      const result = await validationService.validateAll();

      expect(result.schema.passed).toBe(false);
      expect(result.dataIntegrity).toBeUndefined();
      expect(result.health).toBeUndefined();
      expect(result.smokeTests).toBeUndefined();
    });
  });
});
