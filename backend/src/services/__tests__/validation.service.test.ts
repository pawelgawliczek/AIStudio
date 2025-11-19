/**
 * Unit tests for ValidationService
 */

import { ValidationService } from '../validation.service';
import { PrismaClient } from '@prisma/client';
import { execDockerCommand } from '../../utils/docker-exec.util';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../utils/docker-exec.util');

const mockExecDockerCommand = execDockerCommand as jest.MockedFunction<typeof execDockerCommand>;

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
      // Mock psql output for table list
      mockExecDockerCommand.mockResolvedValueOnce('projects\nstories\nepics');
      // Mock psql output for index list
      mockExecDockerCommand.mockResolvedValueOnce('projects_pkey\nstories_pkey');
      // Mock psql output for constraint list
      mockExecDockerCommand.mockResolvedValueOnce('fk_story_project');

      const result = await validationService.validateSchema();

      expect(result.valid).toBe(true);
      expect(result.tableCount).toBeGreaterThan(0);
      expect(result.indexCount).toBeGreaterThan(0);
    });

    it('should fail if tables are missing', async () => {
      mockExecDockerCommand.mockResolvedValueOnce(''); // No tables
      mockExecDockerCommand.mockResolvedValueOnce('');
      mockExecDockerCommand.mockResolvedValueOnce('');

      const result = await validationService.validateSchema();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No tables found');
    });
  });

  describe('validateDataIntegrity', () => {
    it('should validate data integrity successfully', async () => {
      // Mock row counts
      mockPrisma.project.count = jest.fn().mockResolvedValue(10);
      mockPrisma.story.count = jest.fn().mockResolvedValue(50);
      mockPrisma.epic.count = jest.fn().mockResolvedValue(5);

      // Mock FK integrity check
      mockExecDockerCommand.mockResolvedValue('0'); // 0 orphaned records

      const result = await validationService.validateDataIntegrity();

      expect(result.valid).toBe(true);
      expect(result.totalRows).toBe(65);
    });

    it('should detect FK integrity violations', async () => {
      mockPrisma.project.count = jest.fn().mockResolvedValue(10);
      mockPrisma.story.count = jest.fn().mockResolvedValue(50);

      // Mock FK violation
      mockExecDockerCommand.mockResolvedValue('5'); // 5 orphaned records

      const result = await validationService.validateDataIntegrity();

      expect(result.valid).toBe(false);
      expect(result.foreignKeyViolations).toBeGreaterThan(0);
    });
  });

  describe('runHealthChecks', () => {
    it('should run all health checks successfully', async () => {
      // Mock Prisma connection test
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '1': 1 }]);

      // Mock Docker health check
      mockExecDockerCommand.mockResolvedValue('accepting connections');

      const result = await validationService.runHealthChecks();

      expect(result.healthy).toBe(true);
      expect(result.checks.databaseConnection).toBe(true);
      expect(result.checks.prismaClient).toBe(true);
    });

    it('should detect unhealthy database', async () => {
      mockPrisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockExecDockerCommand.mockRejectedValue(new Error('Not accepting connections'));

      const result = await validationService.runHealthChecks();

      expect(result.healthy).toBe(false);
      expect(result.checks.databaseConnection).toBe(false);
    });
  });

  describe('runSmokeTests', () => {
    it('should run smoke tests successfully', async () => {
      // Mock basic CRUD operations
      mockPrisma.project.findMany = jest.fn().mockResolvedValue([{ id: '1', name: 'Test' }]);
      mockPrisma.story.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.epic.findMany = jest.fn().mockResolvedValue([]);

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(true);
      expect(result.testsRun).toBeGreaterThan(0);
      expect(result.testsPassed).toBe(result.testsRun);
    });

    it('should detect failed smoke tests', async () => {
      mockPrisma.project.findMany = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await validationService.runSmokeTests();

      expect(result.passed).toBe(false);
      expect(result.testsFailed).toBeGreaterThan(0);
    });
  });

  describe('validateAll', () => {
    it('should run all validation levels successfully', async () => {
      // Mock all validation methods
      jest.spyOn(validationService, 'validateSchema').mockResolvedValue({
        valid: true,
        tableCount: 30,
        indexCount: 50,
        constraintCount: 40,
      });

      jest.spyOn(validationService, 'validateDataIntegrity').mockResolvedValue({
        valid: true,
        totalRows: 1000,
        foreignKeyViolations: 0,
        nullViolations: 0,
      });

      jest.spyOn(validationService, 'runHealthChecks').mockResolvedValue({
        healthy: true,
        checks: {
          databaseConnection: true,
          prismaClient: true,
          connectionPool: true,
        },
      });

      jest.spyOn(validationService, 'runSmokeTests').mockResolvedValue({
        passed: true,
        testsRun: 10,
        testsPassed: 10,
        testsFailed: 0,
        tests: [],
      });

      const result = await validationService.validateAll('full');

      expect(result.overallValid).toBe(true);
      expect(result.level).toBe('full');
    });

    it('should detect overall validation failure', async () => {
      jest.spyOn(validationService, 'validateSchema').mockResolvedValue({
        valid: false,
        tableCount: 0,
        indexCount: 0,
        constraintCount: 0,
        error: 'Schema invalid',
      });

      const result = await validationService.validateAll('basic');

      expect(result.overallValid).toBe(false);
    });
  });
});
